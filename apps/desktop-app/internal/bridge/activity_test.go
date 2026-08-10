package bridge

import (
	"sync"
	"testing"
	"time"
)

func fixedLog() *activityLog {
	l := newActivityLog()
	at := time.UnixMilli(1_700_000_000_000)
	l.now = func() time.Time { return at }
	return l
}

func TestActivityNewestFirst(t *testing.T) {
	l := fixedLog()
	l.add(ActivityClient, true, "một")
	l.add(ActivityKeyPress, true, "hai")

	got := l.snapshot()
	if len(got) != 2 {
		t.Fatalf("muốn 2 dòng, có %d", len(got))
	}
	// Mới nhất trước: giữa buổi live, thứ vừa xảy ra là thứ cần đọc, và không ai
	// cuộn xuống đáy một danh sách đang dài ra để tìm nó.
	if got[0].Detail != "hai" {
		t.Errorf("muốn dòng mới nhất trước, có %q", got[0].Detail)
	}
}

func TestActivityKeepsReasonForRejection(t *testing.T) {
	s := New()
	s.recordCommand(Reply{Type: CommandKeyPress, OK: false, Error: "phím không được phép"})

	got := s.Activity()
	if len(got) != 1 {
		t.Fatalf("muốn 1 dòng, có %d", len(got))
	}
	if got[0].OK {
		t.Error("một lệnh bị từ chối không được ghi là thành công")
	}
	// Lý do chính là toàn bộ giá trị của dòng này. "Có lệnh nhưng hỏng" thì
	// streamer vẫn phải đoán giữa bốn nguyên nhân có bốn cách sửa khác nhau.
	if got[0].Detail != "phím không được phép" {
		t.Errorf("muốn giữ nguyên lý do, có %q", got[0].Detail)
	}
}

func TestActivityIgnoresPing(t *testing.T) {
	s := New()
	for i := 0; i < 50; i++ {
		s.recordCommand(Reply{Type: CommandPing, OK: true})
	}
	s.recordCommand(Reply{Type: CommandKeyPress, OK: true})

	got := s.Activity()
	// Ping là nhịp tim, mỗi vài giây một lần. Ghi lại thì nó đẩy trôi đúng
	// những dòng mà nhật ký này tồn tại để giữ.
	if len(got) != 1 {
		t.Fatalf("muốn nhịp tim bị bỏ qua, có %d dòng", len(got))
	}
	if got[0].Kind != ActivityKeyPress {
		t.Errorf("muốn dòng bấm phím, có %q", got[0].Kind)
	}
}

func TestActivityDropsOldestWhenFull(t *testing.T) {
	l := fixedLog()
	for i := 0; i < maxActivityEntries+10; i++ {
		l.add(ActivityKeyPress, true, "x")
	}

	got := l.snapshot()
	// Có trần vì đây là công cụ chẩn đoán tại chỗ, không phải kho lưu trữ. Một
	// buổi live sáu tiếng không được làm tiến trình phình ra vì thứ không ai
	// cuộn tới.
	if len(got) != maxActivityEntries {
		t.Fatalf("muốn giữ đúng %d dòng, có %d", maxActivityEntries, len(got))
	}
}

func TestActivitySnapshotIsACopy(t *testing.T) {
	l := fixedLog()
	l.add(ActivityKeyPress, true, "gốc")

	got := l.snapshot()
	got[0].Detail = "bị sửa"

	// Giao diện đọc nhật ký trên một goroutine khác goroutine đang ghi. Trả về
	// lát cắt của mảng nền sẽ để lộ nó cho một lần ghi đồng thời.
	if l.snapshot()[0].Detail != "gốc" {
		t.Error("snapshot phải là bản sao, không phải cửa sổ nhìn vào mảng gốc")
	}
}

func TestActivityIsSafeUnderConcurrentUse(t *testing.T) {
	l := newActivityLog()
	var wg sync.WaitGroup

	// Vòng lặp đọc của socket ghi vào nhật ký trong khi giao diện đọc nó mỗi hai
	// giây. Chạy với `-race` thì test này là thứ bắt được lỗi đó.
	for i := 0; i < 50; i++ {
		wg.Add(2)
		go func() { defer wg.Done(); l.add(ActivityKeyPress, true, "x") }()
		go func() { defer wg.Done(); _ = l.snapshot() }()
	}
	wg.Wait()
}
