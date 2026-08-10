// Package obs is the OBS WebSocket v5 controller.
//
// M-10 — this used to report success unconditionally, so the UI showed
// "connected to OBS" when nothing had been attempted. A connection indicator
// that lies is worse than one that is missing: the streamer only finds out
// mid-broadcast. FR-050 now performs the real handshake.
//
// Phạm vi cố tình hẹp: kiểm tra kết nối, và đổi cảnh. Đó là hai việc một luồng
// quà thực sự cần. Mở một đường gọi RPC tuỳ ý từ WebView sang OBS thì mọi lệnh
// OBS có mặt trong tương lai đều tự động nằm sau ranh giới tin cậy này, kể cả
// những lệnh chưa ai cân nhắc.
package obs

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"time"

	"github.com/gorilla/websocket"
)

// Hạn chờ cho bắt tay và cho một lệnh.
//
// OBS chạy ngay trên máy này, nên năm giây đã là rộng rãi. Cái đáng chặn là
// trường hợp không có ai ở đầu dây: không có hạn chờ thì giao diện đứng im ở
// "đang kết nối" mà không bao giờ kết thúc.
const timeout = 5 * time.Second

// rpcVersion là phiên bản giao thức obs-websocket v5.
const rpcVersion = 1

const (
	opHello      = 0
	opIdentify   = 1
	opIdentified = 2
	opRequest    = 6
	opResponse   = 7
)

type message struct {
	Op int             `json:"op"`
	D  json.RawMessage `json:"d"`
}

type helloData struct {
	RPCVersion     int `json:"rpcVersion"`
	Authentication *struct {
		Challenge string `json:"challenge"`
		Salt      string `json:"salt"`
	} `json:"authentication"`
}

type identifyData struct {
	RPCVersion     int    `json:"rpcVersion"`
	Authentication string `json:"authentication,omitempty"`
}

type requestData struct {
	RequestType string `json:"requestType"`
	RequestID   string `json:"requestId"`
	RequestData any    `json:"requestData,omitempty"`
}

type responseData struct {
	RequestType string `json:"requestType"`
	RequestID   string `json:"requestId"`
	Status      struct {
		Result  bool   `json:"result"`
		Code    int    `json:"code"`
		Comment string `json:"comment"`
	} `json:"requestStatus"`
}

// authToken dựng chuỗi trả lời thách thức theo obs-websocket v5.
//
// Băm hai lần, và giữa hai lần có một bước base64: mật khẩu ghép muối, băm,
// mã hoá base64, ghép thách thức, băm tiếp, base64 lần nữa. Bỏ đúng một bước
// base64 ở giữa vẫn cho ra một chuỗi trông hợp lệ mà OBS luôn từ chối, nên
// hàm này có test riêng đối chiếu với ví dụ trong đặc tả.
func authToken(password, salt, challenge string) string {
	first := sha256.Sum256([]byte(password + salt))
	secret := base64.StdEncoding.EncodeToString(first[:])
	second := sha256.Sum256([]byte(secret + challenge))
	return base64.StdEncoding.EncodeToString(second[:])
}

type session struct {
	conn *websocket.Conn
}

func dial(host string, port uint16, password string) (*session, error) {
	u := url.URL{Scheme: "ws", Host: fmt.Sprintf("%s:%d", host, port)}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	conn, _, err := websocket.DefaultDialer.DialContext(ctx, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("không kết nối được OBS (bật obs-websocket trong OBS chưa?): %w", err)
	}

	if err := conn.SetReadDeadline(time.Now().Add(timeout)); err != nil {
		conn.Close()
		return nil, err
	}

	var hello message
	if err := conn.ReadJSON(&hello); err != nil {
		conn.Close()
		return nil, fmt.Errorf("không đọc được lời chào của OBS: %w", err)
	}
	if hello.Op != opHello {
		conn.Close()
		return nil, fmt.Errorf("OBS gửi op %d thay vì lời chào", hello.Op)
	}

	var h helloData
	if err := json.Unmarshal(hello.D, &h); err != nil {
		conn.Close()
		return nil, err
	}

	ident := identifyData{RPCVersion: rpcVersion}
	if h.Authentication != nil {
		// OBS đòi mật khẩu mà người dùng để trống: báo đúng nguyên nhân thay vì
		// gửi một chuỗi rỗng rồi trả về "kết nối thất bại" chung chung.
		if password == "" {
			conn.Close()
			return nil, fmt.Errorf("OBS đang bật xác thực, cần nhập mật khẩu obs-websocket")
		}
		ident.Authentication = authToken(password, h.Authentication.Salt, h.Authentication.Challenge)
	}

	payload, err := json.Marshal(ident)
	if err != nil {
		conn.Close()
		return nil, err
	}
	if err := conn.WriteJSON(message{Op: opIdentify, D: payload}); err != nil {
		conn.Close()
		return nil, err
	}

	var reply message
	if err := conn.ReadJSON(&reply); err != nil {
		// OBS đóng kết nối khi sai mật khẩu thay vì trả về lỗi có nội dung, nên
		// đây là cách duy nhất nhận ra chuyện đó.
		conn.Close()
		return nil, fmt.Errorf("OBS từ chối kết nối (mật khẩu obs-websocket có đúng không?): %w", err)
	}
	if reply.Op != opIdentified {
		conn.Close()
		return nil, fmt.Errorf("OBS gửi op %d thay vì xác nhận", reply.Op)
	}

	return &session{conn: conn}, nil
}

func (s *session) close() { _ = s.conn.Close() }

func (s *session) request(requestType string, data any) error {
	payload, err := json.Marshal(requestData{
		RequestType: requestType,
		RequestID:   requestType,
		RequestData: data,
	})
	if err != nil {
		return err
	}
	if err := s.conn.WriteJSON(message{Op: opRequest, D: payload}); err != nil {
		return err
	}

	if err := s.conn.SetReadDeadline(time.Now().Add(timeout)); err != nil {
		return err
	}
	for {
		var msg message
		if err := s.conn.ReadJSON(&msg); err != nil {
			return err
		}
		// OBS phát sự kiện (op 5) xen giữa các câu trả lời. Đọc đúng một khung
		// rồi coi đó là kết quả sẽ hỏng ngay khi có ai đó chạm vào OBS.
		if msg.Op != opResponse {
			continue
		}
		var resp responseData
		if err := json.Unmarshal(msg.D, &resp); err != nil {
			return err
		}
		if !resp.Status.Result {
			return fmt.Errorf("OBS từ chối %s: %s", requestType, resp.Status.Comment)
		}
		return nil
	}
}

// Connect kiểm tra rằng OBS có ở đó và mật khẩu đúng, rồi ngắt.
//
// Không giữ kết nối: ứng dụng chưa có gì cần một kết nối lâu dài, và một socket
// mở sẵn phải kèm theo cả việc tự nối lại — thứ chỉ đáng viết khi đã có người
// dùng nó.
func Connect(host string, port uint16, password string) (bool, error) {
	s, err := dial(host, port, password)
	if err != nil {
		return false, err
	}
	s.close()
	return true, nil
}

// SetScene chuyển cảnh hiện tại trong OBS.
func SetScene(host string, port uint16, password, scene string) error {
	if scene == "" {
		return fmt.Errorf("chưa chọn tên cảnh")
	}
	s, err := dial(host, port, password)
	if err != nil {
		return err
	}
	defer s.close()

	return s.request("SetCurrentProgramScene", map[string]string{"sceneName": scene})
}
