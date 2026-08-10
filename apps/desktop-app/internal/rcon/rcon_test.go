package rcon

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"errors"
	"io"
	"net"
	"strings"
	"testing"
)

// fakeServer đóng vai máy chủ game ở đầu kia của net.Pipe.
//
// Chạy trên pipe chứ không mở cổng thật: một test mở cổng sẽ hỏng trên máy có
// tường lửa chặn, và hỏng ngẫu nhiên khi hai lần chạy trùng cổng.
func fakeServer(t *testing.T, handle func(r *bufio.Reader, w io.Writer)) io.ReadWriter {
	t.Helper()
	client, server := net.Pipe()
	t.Cleanup(func() { client.Close(); server.Close() })

	go func() {
		defer server.Close()
		handle(bufio.NewReader(server), server)
	}()
	return client
}

func TestExecuteReturnsServerOutput(t *testing.T) {
	conn := fakeServer(t, func(r *bufio.Reader, w io.Writer) {
		auth, err := readPacket(r)
		if err != nil {
			return
		}
		_ = writePacket(w, packet{id: auth.id, typ: typeAuthResponse})
		cmd, err := readPacket(r)
		if err != nil {
			return
		}
		_ = writePacket(w, packet{id: cmd.id, typ: typeResponseValue, body: "đã đổi thời tiết"})
	})

	got, err := run(conn, "mật-khẩu", "weather rain")
	if err != nil {
		t.Fatalf("không mong đợi lỗi: %v", err)
	}
	if got != "đã đổi thời tiết" {
		t.Errorf("muốn nội dung máy chủ trả về, có %q", got)
	}
}

func TestExecuteReportsBadPasswordDistinctly(t *testing.T) {
	conn := fakeServer(t, func(r *bufio.Reader, w io.Writer) {
		if _, err := readPacket(r); err != nil {
			return
		}
		// -1 là cách máy chủ Source báo sai mật khẩu.
		_ = writePacket(w, packet{id: -1, typ: typeAuthResponse})
	})

	_, err := run(conn, "sai", "say xin chào")
	// Sai mật khẩu và không nối được máy chủ có hai cách sửa khác nhau, nên
	// người gọi phải phân biệt được chúng chứ không chỉ thấy "RCON hỏng".
	if !errors.Is(err, ErrAuth) {
		t.Errorf("muốn ErrAuth, có %v", err)
	}
}

func TestExecuteSkipsEmptyPaddingPacket(t *testing.T) {
	conn := fakeServer(t, func(r *bufio.Reader, w io.Writer) {
		auth, err := readPacket(r)
		if err != nil {
			return
		}
		// Nhiều máy chủ chèn một RESPONSE_VALUE rỗng trước câu trả lời xác thực.
		// Đọc nhầm nó thành kết quả thì lệnh sau đó lệch đúng một gói và trả về
		// chuỗi rỗng thay vì kết quả thật.
		_ = writePacket(w, packet{id: auth.id, typ: typeResponseValue})
		_ = writePacket(w, packet{id: auth.id, typ: typeAuthResponse})
		cmd, err := readPacket(r)
		if err != nil {
			return
		}
		_ = writePacket(w, packet{id: cmd.id, typ: typeResponseValue, body: "ok"})
	})

	got, err := run(conn, "mật-khẩu", "list")
	if err != nil {
		t.Fatalf("không mong đợi lỗi: %v", err)
	}
	if got != "ok" {
		t.Errorf("muốn %q, có %q", "ok", got)
	}
}

func TestExecuteRejectsOverlongCommand(t *testing.T) {
	_, err := Execute("127.0.0.1", 25575, "mật-khẩu", strings.Repeat("a", MaxCommandLen+1))
	// Kiểm tra trước khi quay số: một lệnh chắc chắn bị từ chối thì không đáng
	// mở kết nối, và thông báo lỗi nói đúng nguyên nhân.
	if err == nil {
		t.Fatal("muốn lệnh quá dài bị từ chối")
	}
	if !strings.Contains(err.Error(), "quá dài") {
		t.Errorf("muốn lỗi nói lệnh quá dài, có %v", err)
	}
}

func TestReadPacketRejectsAbsurdLength(t *testing.T) {
	var buf bytes.Buffer
	_ = binary.Write(&buf, binary.LittleEndian, int32(1<<30))

	// Trường độ dài do đầu kia khai. Tin nó nghĩa là một máy chủ hỏng — hoặc cố
	// tình — buộc được ứng dụng cấp phát một gigabyte.
	if _, err := readPacket(&buf); err == nil {
		t.Fatal("muốn từ chối độ dài gói vô lý")
	}
}

func TestReadPacketRejectsTruncatedBody(t *testing.T) {
	var buf bytes.Buffer
	_ = binary.Write(&buf, binary.LittleEndian, int32(20))
	buf.Write(make([]byte, 5))

	// TCP được phép trả về ít byte hơn số đã yêu cầu. Nhận một thân gói cụt mà
	// vẫn coi là hợp lệ sẽ làm lệch mọi gói còn lại trong phiên.
	if _, err := readPacket(&buf); err == nil {
		t.Fatal("muốn từ chối gói bị cắt cụt")
	}
}
