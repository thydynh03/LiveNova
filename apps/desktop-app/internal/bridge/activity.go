package bridge

import (
	"sync"
	"time"
)

// Nhật ký những gì Local Bridge vừa làm.
//
// Cho tới giờ ứng dụng máy tính chỉ hiện đúng một câu: bridge đang chạy hay
// không. Khi một món quà đáng lẽ phải bấm phím vào game mà không có gì xảy ra,
// streamer không có cách nào phân biệt bốn khả năng hoàn toàn khác nhau: lệnh
// chưa từng tới nơi, phím không nằm trong danh sách cho phép, lệnh bị chặn vì
// cooldown, hay nút dừng khẩn cấp đang bật.
//
// Đó là bốn cách sửa khác nhau, và giữa buổi live thì không có thời gian đoán.
//
// Cùng lý do như `/metrics` phía máy chủ: thứ đáng ghi lại không phải "có chạy
// không" mà là "cái gì vừa xảy ra và vì sao nó thất bại".
type ActivityKind string

const (
	// ActivityKeyPress — một phím đã thực sự được bấm.
	ActivityKeyPress ActivityKind = "key_press"
	// ActivityRejected — lệnh tới nơi nhưng bị từ chối, kèm lý do.
	ActivityRejected ActivityKind = "rejected"
	// ActivityHalt — nút dừng khẩn cấp được bật hoặc tắt.
	ActivityHalt ActivityKind = "halt"
	// ActivityClient — một client kết nối hoặc ngắt.
	ActivityClient ActivityKind = "client"
)

// Entry là một dòng trong nhật ký.
type Entry struct {
	AtMS   int64        `json:"atMs"`
	Kind   ActivityKind `json:"kind"`
	Detail string       `json:"detail"`
	// OK phân biệt "đã làm được" với "đã bị từ chối". Giao diện tô màu theo
	// trường này, nên một dòng thất bại không trôi qua như một dòng bình thường.
	OK bool `json:"ok"`
}

// maxActivityEntries giới hạn nhật ký.
//
// Nó phục vụ việc chẩn đoán ngay lúc đó, không phải lưu trữ: cái đáng xem là
// vài chục sự kiện gần nhất. Giữ nhiều hơn chỉ làm tiến trình phình ra trong
// một buổi live dài để đổi lấy thứ không ai cuộn tới.
const maxActivityEntries = 100

type activityLog struct {
	mu      sync.RWMutex
	entries []Entry
	// now cho phép test kiểm nội dung mà không phụ thuộc đồng hồ thật.
	now func() time.Time
}

func newActivityLog() *activityLog {
	return &activityLog{now: time.Now}
}

func (l *activityLog) add(kind ActivityKind, ok bool, detail string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.entries = append(l.entries, Entry{
		AtMS:   l.now().UnixMilli(),
		Kind:   kind,
		Detail: detail,
		OK:     ok,
	})

	if len(l.entries) > maxActivityEntries {
		// Bỏ từ đầu: dòng cũ nhất là dòng ít liên quan nhất tới thứ vừa hỏng.
		l.entries = l.entries[len(l.entries)-maxActivityEntries:]
	}
}

// snapshot trả về bản sao, mới nhất trước.
//
// Bản sao chứ không phải lát cắt của mảng gốc: giao diện đọc nó trên một
// goroutine khác với goroutine đang ghi, và trả về lát cắt sẽ để lộ mảng nền
// cho một lần ghi đồng thời.
func (l *activityLog) snapshot() []Entry {
	l.mu.RLock()
	defer l.mu.RUnlock()

	out := make([]Entry, len(l.entries))
	for i, e := range l.entries {
		out[len(l.entries)-1-i] = e
	}
	return out
}
