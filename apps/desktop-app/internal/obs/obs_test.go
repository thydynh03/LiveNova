package obs

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/gorilla/websocket"
)

// TestAuthTokenMatchesSpecVector cố định chuỗi trả lời thách thức.
//
// Đây là test duy nhất ở đây bắt được lỗi im lặng. Bỏ bước base64 giữa hai lần
// băm vẫn cho ra một chuỗi trông đúng định dạng; nó chỉ sai ở chỗ OBS luôn từ
// chối, và lỗi hiện ra lúc đó là "sai mật khẩu" — chỉ thẳng vào người dùng,
// sai chỗ.
//
// Xuất xứ của các con số: mật khẩu, muối và thách thức lấy nguyên từ ví dụ
// trong tài liệu obs-websocket v5. Tài liệu **không in kết quả**, nên hai chuỗi
// kỳ vọng dưới đây được đối chiếu chéo với một cài đặt độc lập bằng
// `crypto` của Node, không phải chép lại đầu ra của chính hàm này.
func TestAuthTokenMatchesSpecVector(t *testing.T) {
	const (
		password  = "supersecretpassword"
		salt      = "lM1GncleQOaCu9lT1yeUZhFYnqhsLLP1G5lAGo3ixaI="
		challenge = "+IxH4CnCiqpX1rM9scsNynZzbOe4KhDeYcTNS3PDaeY="
	)

	// Cố định luôn giá trị trung gian: nếu chỉ kiểm kết quả cuối thì một lỗi ở
	// bước băm thứ nhất và một lỗi ở bước thứ hai trông giống hệt nhau.
	first := sha256.Sum256([]byte(password + salt))
	const wantSecret = "H1IfVz1pSREUQzbFTVnX/Tyb+gMhMik5x7yUBCY0PTs="
	if got := base64.StdEncoding.EncodeToString(first[:]); got != wantSecret {
		t.Errorf("bước băm thứ nhất: muốn %q, có %q", wantSecret, got)
	}

	const want = "1Ct943GAT+6YQUUX47Ia/ncufilbe6+oD6lY+5kaCu4="
	if got := authToken(password, salt, challenge); got != want {
		t.Errorf("muốn %q, có %q", want, got)
	}
}

// obsServer đóng vai OBS: gửi lời chào rồi xác nhận.
func obsServer(t *testing.T, auth bool, onIdentify func(token string)) (string, uint16) {
	t.Helper()

	up := websocket.Upgrader{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := up.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer c.Close()

		hello := helloData{RPCVersion: rpcVersion}
		if auth {
			hello.Authentication = &struct {
				Challenge string `json:"challenge"`
				Salt      string `json:"salt"`
			}{Challenge: "thách-thức", Salt: "muối"}
		}
		d, _ := json.Marshal(hello)
		if err := c.WriteJSON(message{Op: opHello, D: d}); err != nil {
			return
		}

		var msg message
		if err := c.ReadJSON(&msg); err != nil {
			return
		}
		var ident identifyData
		_ = json.Unmarshal(msg.D, &ident)
		if onIdentify != nil {
			onIdentify(ident.Authentication)
		}
		_ = c.WriteJSON(message{Op: opIdentified, D: json.RawMessage(`{}`)})
	}))
	t.Cleanup(srv.Close)

	host, portStr, err := net.SplitHostPort(strings.TrimPrefix(srv.URL, "http://"))
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		t.Fatal(err)
	}
	return host, uint16(port)
}

func TestConnectCompletesHandshake(t *testing.T) {
	host, port := obsServer(t, false, nil)

	ok, err := Connect(host, port, "")
	if err != nil || !ok {
		t.Fatalf("muốn bắt tay thành công, có ok=%v err=%v", ok, err)
	}
}

func TestConnectSendsAuthTokenWhenChallenged(t *testing.T) {
	var seen string
	host, port := obsServer(t, true, func(token string) { seen = token })

	if _, err := Connect(host, port, "mật-khẩu"); err != nil {
		t.Fatalf("không mong đợi lỗi: %v", err)
	}
	want := authToken("mật-khẩu", "muối", "thách-thức")
	if seen != want {
		t.Errorf("muốn gửi chuỗi trả lời thách thức, có %q", seen)
	}
}

func TestConnectSaysWhichPasswordIsMissing(t *testing.T) {
	host, port := obsServer(t, true, nil)

	_, err := Connect(host, port, "")
	if err == nil {
		t.Fatal("muốn lỗi khi OBS đòi mật khẩu mà không có")
	}
	// "kết nối thất bại" gửi streamer đi kiểm tra cổng và tường lửa. Nguyên nhân
	// thật là một ô nhập còn trống, và câu lỗi phải nói ra điều đó.
	if !strings.Contains(err.Error(), "mật khẩu") {
		t.Errorf("muốn lỗi chỉ ra thiếu mật khẩu, có %v", err)
	}
}

func TestConnectFailsWhenNothingIsListening(t *testing.T) {
	// Cổng đóng: OBS chưa mở, hoặc obs-websocket chưa được bật. Trước FR-050
	// trường hợp này trả về "đã kết nối".
	ok, err := Connect("127.0.0.1", 1, "")
	if ok || err == nil {
		t.Fatalf("muốn báo lỗi khi không có gì lắng nghe, có ok=%v err=%v", ok, err)
	}
}

func TestSetSceneRejectsEmptyName(t *testing.T) {
	if err := SetScene("127.0.0.1", 4455, "", ""); err == nil {
		t.Fatal("muốn từ chối tên cảnh trống")
	}
}

func TestSetSceneSendsRequestAndReportsRefusal(t *testing.T) {
	up := websocket.Upgrader{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := up.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer c.Close()

		d, _ := json.Marshal(helloData{RPCVersion: rpcVersion})
		_ = c.WriteJSON(message{Op: opHello, D: d})
		var msg message
		if err := c.ReadJSON(&msg); err != nil {
			return
		}
		_ = c.WriteJSON(message{Op: opIdentified, D: json.RawMessage(`{}`)})

		if err := c.ReadJSON(&msg); err != nil {
			return
		}
		// Một sự kiện xen vào trước câu trả lời: OBS phát chúng bất cứ lúc nào
		// có ai chạm vào giao diện. Đọc đúng một khung rồi coi là kết quả sẽ
		// hỏng ngay lần đầu điều đó xảy ra.
		_ = c.WriteJSON(message{Op: 5, D: json.RawMessage(`{"eventType":"SceneItemCreated"}`)})

		resp := responseData{RequestType: "SetCurrentProgramScene", RequestID: "SetCurrentProgramScene"}
		resp.Status.Result = false
		resp.Status.Comment = "không có cảnh nào tên đó"
		rd, _ := json.Marshal(resp)
		_ = c.WriteJSON(message{Op: opResponse, D: rd})
	}))
	defer srv.Close()

	host, portStr, _ := net.SplitHostPort(strings.TrimPrefix(srv.URL, "http://"))
	port, _ := strconv.Atoi(portStr)

	err := SetScene(host, uint16(port), "", "Cảnh không tồn tại")
	if err == nil {
		t.Fatal("muốn báo lỗi khi OBS từ chối")
	}
	// Lý do của OBS là toàn bộ giá trị chẩn đoán ở đây.
	if !strings.Contains(err.Error(), "không có cảnh nào tên đó") {
		t.Errorf("muốn giữ nguyên lý do OBS đưa ra, có %v", err)
	}
}
