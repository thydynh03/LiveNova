// Package rcon is the Source RCON client.
//
// M-10 — this used to return a mock response, which meant the caller could not
// distinguish "the game executed this" from "nothing happened". Gift-triggered
// game actions are visible to the audience, so a silent no-op is a user-facing
// failure. FR-054 now implements the protocol for real.
//
// Viết tay thay vì kéo thêm một thư viện: giao thức Source RCON là bốn số
// nguyên và hai chuỗi kết thúc bằng byte 0. Phần khó không nằm ở việc đóng gói
// mà ở những chỗ dễ sai bên dưới — đọc thiếu byte, máy chủ treo, và mật khẩu
// lọt vào nhật ký — và những chỗ đó thì thư viện nào cũng không tự lo hộ.
package rcon

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"strconv"
	"time"
)

// MaxCommandLen bounds what the WebView may hand to a game server.
const MaxCommandLen = 512

// Kích thước gói tối đa theo đặc tả Source RCON.
//
// Có trần vì trường độ dài do máy chủ ở đầu kia khai báo. Không chặn thì một
// máy chủ hỏng — hoặc một máy chủ cố tình — chỉ cần khai 2 GB là buộc ứng dụng
// cấp phát đúng ngần ấy.
const maxPacketSize = 4096

// Thời gian chờ cho toàn bộ phiên: quay số, xác thực, gửi lệnh, đọc trả lời.
//
// Đường đi của một món quà là đồng bộ: người xem tặng, lệnh chạy, hiệu ứng lên
// màn hình. Một máy chủ game treo mà không có hạn chờ sẽ giữ luôn cả chuỗi đó,
// và khán giả nhìn thấy một khoảng lặng không ai giải thích được.
const sessionTimeout = 5 * time.Second

const (
	typeResponseValue = 0
	typeExecCommand   = 2
	typeAuthResponse  = 2
	typeAuth          = 3
)

// ErrAuth là mật khẩu RCON sai.
//
// Tách khỏi lỗi mạng vì hai bên cần hai cách sửa khác nhau: một bên là sửa mật
// khẩu trong cài đặt, bên kia là xem lại máy chủ hay tường lửa.
var ErrAuth = errors.New("sai mật khẩu RCON")

type packet struct {
	id   int32
	typ  int32
	body string
}

func writePacket(w io.Writer, p packet) error {
	// size đếm id + type + body + hai byte 0 kết thúc, không tính chính nó.
	size := int32(4 + 4 + len(p.body) + 2)
	buf := bytes.NewBuffer(make([]byte, 0, int(size)+4))
	for _, v := range []int32{size, p.id, p.typ} {
		if err := binary.Write(buf, binary.LittleEndian, v); err != nil {
			return err
		}
	}
	buf.WriteString(p.body)
	buf.Write([]byte{0, 0})

	_, err := w.Write(buf.Bytes())
	return err
}

func readPacket(r io.Reader) (packet, error) {
	var size int32
	if err := binary.Read(r, binary.LittleEndian, &size); err != nil {
		return packet{}, err
	}
	// 10 là gói hợp lệ nhỏ nhất: id + type + hai byte 0.
	if size < 10 || size > maxPacketSize {
		return packet{}, fmt.Errorf("máy chủ khai độ dài gói không hợp lệ: %d", size)
	}

	body := make([]byte, size)
	// ReadFull chứ không phải Read: TCP được phép trả về ít hơn số byte yêu cầu,
	// và một lần đọc ngắn sẽ làm lệch mọi gói sau đó trong phiên.
	if _, err := io.ReadFull(r, body); err != nil {
		return packet{}, err
	}

	p := packet{
		id:  int32(binary.LittleEndian.Uint32(body[0:4])),
		typ: int32(binary.LittleEndian.Uint32(body[4:8])),
	}
	p.body = string(bytes.TrimRight(body[8:], "\x00"))
	return p, nil
}

// Execute xác thực rồi chạy một lệnh, trả về phần máy chủ in ra.
//
// Người gọi phải kiểm tra host bằng netguard trước: gói này không tự quyết định
// được đâu là đích hợp lệ.
func Execute(host string, port uint16, password, command string) (string, error) {
	if len(command) > MaxCommandLen {
		return "", fmt.Errorf("lệnh RCON quá dài (tối đa %d byte)", MaxCommandLen)
	}

	addr := net.JoinHostPort(host, strconv.Itoa(int(port)))
	conn, err := net.DialTimeout("tcp", addr, sessionTimeout)
	if err != nil {
		return "", fmt.Errorf("không kết nối được máy chủ game: %w", err)
	}
	defer conn.Close()

	// Một hạn chót cho cả phiên, không phải mỗi thao tác một hạn. Chuỗi thao tác
	// đặt lại hạn chờ sau từng bước có thể kéo dài vô hạn miễn là mỗi bước riêng
	// lẻ vẫn kịp.
	if err := conn.SetDeadline(time.Now().Add(sessionTimeout)); err != nil {
		return "", err
	}

	return run(conn, password, command)
}

// run tách khỏi Execute để test chạy được trên net.Pipe, không cần cổng thật.
func run(conn io.ReadWriter, password, command string) (string, error) {
	r := bufio.NewReader(conn)

	const authID int32 = 1
	if err := writePacket(conn, packet{id: authID, typ: typeAuth, body: password}); err != nil {
		return "", err
	}

	// Nhiều máy chủ gửi một RESPONSE_VALUE rỗng trước câu trả lời xác thực. Nó
	// là phần đệm của giao thức, không phải kết quả, nên phải bỏ qua chứ không
	// được đọc nhầm thành "đăng nhập thành công".
	for {
		p, err := readPacket(r)
		if err != nil {
			return "", fmt.Errorf("không đọc được trả lời xác thực: %w", err)
		}
		if p.typ == typeResponseValue && p.id != -1 {
			continue
		}
		if p.typ != typeAuthResponse {
			continue
		}
		// -1 là cách máy chủ báo sai mật khẩu. Không so sánh với authID mà chỉ
		// kiểm tra khác -1: có máy chủ trả về id khác dù đã cho vào.
		if p.id == -1 {
			return "", ErrAuth
		}
		break
	}

	const cmdID int32 = 2
	if err := writePacket(conn, packet{id: cmdID, typ: typeExecCommand, body: command}); err != nil {
		return "", err
	}

	p, err := readPacket(r)
	if err != nil {
		return "", fmt.Errorf("không đọc được trả lời lệnh: %w", err)
	}
	return p.body, nil
}
