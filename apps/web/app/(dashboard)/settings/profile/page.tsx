'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { motion } from 'motion/react';
import { updateProfile, changePassword, listSessions, revokeSession } from '../../../../lib/api-client';
import { Icon, type IconName } from '../../../../components/ui/Icon';

type TabId = 'profile' | 'security' | 'sessions';

const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'profile', label: 'Hồ sơ', icon: 'user' },
  { id: 'security', label: 'Mật khẩu', icon: 'lock' },
  { id: 'sessions', label: 'Thiết bị', icon: 'device' },
];

/*
 * These surfaces used translucent white fills, which only ever read correctly
 * on a dark background. On the light theme they were invisible. Tokens instead.
 */
const cardStyle: React.CSSProperties = {
  padding: '1.75rem',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  marginBottom: '2rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: 'var(--radius)',
  border: '1px solid hsl(var(--input))',
  background: 'hsl(var(--background))',
  color: 'inherit',
  fontSize: '0.95rem',
};

export default function ProfileSettingsPage() {
  const { user, refreshUser, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('profile');

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
        Trang cá nhân & <span className="accent">Cài đặt bảo mật</span>
      </h1>
      <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '2rem' }}>
        Quản lý thông tin tài khoản, mật khẩu và phiên làm việc trên các thiết bị.
      </p>

      {/*
        Tabs, driven by a list rather than three copy-pasted buttons.

        The active tab is marked by an underline that slides between tabs via a
        shared layoutId, so the eye tracks one moving marker instead of a filled
        pill blinking on and off in a new place.
      */}
      <div
        role="tablist"
        aria-label="Cài đặt tài khoản"
        style={{
          display: 'flex',
          gap: '0.25rem',
          marginBottom: '1.75rem',
          borderBottom: '1px solid hsl(var(--border))',
          flexWrap: 'wrap',
        }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                minHeight: '44px',
                padding: '0.6rem 1rem',
                border: 'none',
                background: 'transparent',
                color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              <Icon name={tab.icon} size={18} />
              {tab.label}
              {tab.id === 'sessions' && ` (${sessions.length})`}
              {active && (
                <motion.span
                  layoutId="profile-tab-underline"
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: '-1px',
                    height: '2px',
                    background: 'hsl(var(--primary))',
                  }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
            </button>
          );
        })}
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
                color: profileMsg.type === 'success' ? '#4ade80' : 'hsl(var(--destructive))',
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
                background: 'hsl(var(--primary))',
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
                color: pwdMsg.type === 'success' ? '#4ade80' : 'hsl(var(--destructive))',
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
                background: 'hsl(var(--primary))',
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
                background: 'transparent',
                color: 'hsl(var(--destructive))',
                border: '1px solid hsl(var(--destructive) / 0.4)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                minHeight: '44px',
              }}
            >
              <Icon name="signOut" size={16} />
              Đăng xuất thiết bị này
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
                    background: 'hsl(var(--muted) / 0.5)',
                    border: '1px solid hsl(var(--border))',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Icon name="desktop" size={16} />
                      {String(s.userAgent || 'Thiết bị không xác định')}
                      {index === 0 && (
                        <span style={{ fontSize: '0.75rem', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
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
                      color: 'hsl(var(--destructive))',
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
