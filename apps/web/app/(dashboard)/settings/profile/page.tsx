'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { updateProfile, changePassword, listSessions, revokeSession } from '../../../../lib/api-client';

const cardStyle: React.CSSProperties = {
  padding: '1.75rem',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--glass-border)',
  background: 'rgba(255, 255, 255, 0.03)',
  marginBottom: '2rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--glass-border)',
  background: 'rgba(255, 255, 255, 0.05)',
  color: 'inherit',
  fontSize: '0.95rem',
  outline: 'none',
};

export default function ProfileSettingsPage() {
  const { user, refreshUser, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'sessions'>('profile');

  // Profile Form
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [locale, setLocale] = useState(user?.locale || 'vi');
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Ho_Chi_Minh');
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Change Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingPwd, setSavingPwd] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<Array<Record<string, unknown>>>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setAvatar(user.avatar || '');
      setLocale(user.locale || 'vi');
      setTimezone(user.timezone || 'Asia/Ho_Chi_Minh');
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'sessions') {
      loadSessionsList();
    }
  }, [activeTab]);

  async function loadSessionsList() {
    setLoadingSessions(true);
    try {
      const res = await listSessions();
      setSessions(res.sessions || []);
    } catch {
      // ignore
    } finally {
      setLoadingSessions(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setSavingProfile(true);

    try {
      await updateProfile({ displayName, avatar, locale, timezone });
      await refreshUser();
      setProfileMsg({ type: 'success', text: 'Cập nhật thông tin cá nhân thành công!' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err instanceof Error ? err.message : 'Cập nhật thất bại' });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);

    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'Mật khẩu mới không khớp' });
      return;
    }

    if (newPassword.length < 8) {
      setPwdMsg({ type: 'error', text: 'Mật khẩu mới tối thiểu 8 ký tự' });
      return;
    }

    setSavingPwd(true);

    try {
      await changePassword(currentPassword, newPassword);
      setPwdMsg({ type: 'success', text: 'Đổi mật khẩu thành công! Đang đăng xuất để bạn đăng nhập lại...' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        signOut();
      }, 2000);
    } catch (err) {
      setPwdMsg({ type: 'error', text: err instanceof Error ? err.message : 'Đổi mật khẩu thất bại' });
    } finally {
      setSavingPwd(false);
    }
  }

  async function handleRevokeSession(id: string) {
    try {
      await revokeSession(id);
      await loadSessionsList();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể đăng xuất phiên');
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '850px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Trang cá nhân & <span className="text-gradient">Cài đặt bảo mật</span>
      </h1>
      <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '2rem' }}>
        Quản lý thông tin tài khoản, mật khẩu và phiên làm việc trên các thiết bị.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: 'var(--radius)',
            border: 'none',
            background: activeTab === 'profile' ? '#6366f1' : 'transparent',
            color: activeTab === 'profile' ? '#fff' : 'hsl(var(--muted-foreground))',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          👤 Hồ sơ cá nhân
        </button>
        <button
          onClick={() => setActiveTab('security')}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: 'var(--radius)',
            border: 'none',
            background: activeTab === 'security' ? '#6366f1' : 'transparent',
            color: activeTab === 'security' ? '#fff' : 'hsl(var(--muted-foreground))',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🔒 Đổi mật khẩu
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: 'var(--radius)',
            border: 'none',
            background: activeTab === 'sessions' ? '#6366f1' : 'transparent',
            color: activeTab === 'sessions' ? '#fff' : 'hsl(var(--muted-foreground))',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          📱 Thiết bị đăng nhập ({sessions.length})
        </button>
      </div>

      {/* TAB 1: Profile */}
      {activeTab === 'profile' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.25rem' }}>Thông tin hồ sơ</h2>

          {profileMsg && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius)',
                background: profileMsg.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: profileMsg.type === 'success' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                color: profileMsg.type === 'success' ? '#4ade80' : '#f87171',
                marginBottom: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleSaveProfile}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>Email đăng ký (Cố định)</label>
              <input type="text" disabled value={user?.email || ''} style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>Tên hiển thị / Streamer Name</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} required />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>Đường dẫn Ảnh đại diện (Avatar URL)</label>
              <input type="url" placeholder="https://example.com/avatar.jpg" value={avatar} onChange={(e) => setAvatar(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>Ngôn ngữ giao diện</label>
                <select value={locale} onChange={(e) => setLocale(e.target.value)} style={{ ...inputStyle, background: '#18181b' }}>
                  <option value="vi">Tiếng Việt (VN)</option>
                  <option value="en">English (US)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>Múi giờ làm việc</label>
                <input type="text" value={timezone} onChange={(e) => setTimezone(e.target.value)} style={inputStyle} required />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: 'var(--radius)',
                background: '#6366f1',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: savingProfile ? 'not-allowed' : 'pointer',
              }}
            >
              {savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: Security */}
      {activeTab === 'security' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.25rem' }}>Đổi mật khẩu tài khoản</h2>

          {pwdMsg && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius)',
                background: pwdMsg.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: pwdMsg.type === 'success' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                color: pwdMsg.type === 'success' ? '#4ade80' : '#f87171',
                marginBottom: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              {pwdMsg.text}
            </div>
          )}

          <form onSubmit={handleChangePassword}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>Mật khẩu hiện tại</label>
              <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>Mật khẩu mới (Tối thiểu 8 ký tự)</label>
              <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>Nhập lại mật khẩu mới</label>
              <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} />
            </div>

            <button
              type="submit"
              disabled={savingPwd}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: 'var(--radius)',
                background: '#6366f1',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: savingPwd ? 'not-allowed' : 'pointer',
              }}
            >
              {savingPwd ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: Sessions */}
      {activeTab === 'sessions' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Quản lý các thiết bị đang đăng nhập</h2>
            <button
              onClick={() => signOut()}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius)',
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              🚪 Đăng xuất khỏi thiết bị này
            </button>
          </div>

          {loadingSessions ? (
            <p>Đang tải danh sách thiết bị...</p>
          ) : sessions.length === 0 ? (
            <p style={{ color: 'hsl(var(--muted-foreground))' }}>Không tìm thấy phiên đăng nhập nào.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {sessions.map((s, index) => (
                <div
                  key={String(s.id)}
                  style={{
                    padding: '1rem 1.25rem',
                    borderRadius: 'var(--radius)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--glass-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      💻 {String(s.userAgent || 'Thiết bị không xác định')}
                      {index === 0 && (
                        <span style={{ fontSize: '0.75rem', background: '#6366f1', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '10px', fontWeight: 500 }}>
                          Thiết bị này
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                      IP: {String(s.ip || 'Không xác định')} • Đăng nhập: {new Date(String(s.createdAt)).toLocaleString('vi-VN')}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeSession(String(s.id))}
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: '6px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#f87171',
                      border: 'none',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Đăng xuất
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
