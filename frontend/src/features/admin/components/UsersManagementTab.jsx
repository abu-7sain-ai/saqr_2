import React, { useState, useEffect } from 'react'
import { UserCheck, UserX, Clock, Search, Shield, Loader2, UserPlus } from 'lucide-react'
import { supabase } from '../../../services/supabase'

const UsersManagementTab = () => {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', password: '', username: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', id)
      if (error) throw error
      setUsers(users.map((u) => (u.id === id ? { ...u, status: newStatus } : u)))
    } catch (err) {
      console.error('Error updating user status:', err)
      alert('خطأ في تحديث الحالة')
    }
  }

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password) {
      setCreateError('البريد الإلكتروني وكلمة المرور مطلوبان')
      return
    }
    setCreating(true)
    setCreateError('')
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/admin/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUser.email,
          password: newUser.password,
          username: newUser.username
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'خطأ في إنشاء المستخدم')
      setShowCreateModal(false)
      setNewUser({ email: '', password: '', username: '' })
      await fetchUsers()
      alert(`✅ تم إنشاء المستخدم "${newUser.username || newUser.email}" بنجاح!`)
    } catch (err) {
      setCreateError(err.message || 'خطأ في إنشاء المستخدم')
    } finally {
      setCreating(false)
    }
  }

  const filteredUsers = users.filter(u =>
    !searchQuery ||
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading)
    return (
      <div className="d-flex justify-content-center py-5">
        <Loader2 className="animate-spin text-gold" size={40} />
      </div>
    )

  return (
    <div className="animate-fade-in">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h5 className="text-white fw-bold m-0 mb-1">إدارة المستخدمين</h5>
          <p className="text-secondary small m-0">قائمة المسجلين وصلاحيات الدخول لمنصة الصقر</p>
        </div>
        <div className="d-flex gap-3 align-items-center flex-wrap">
          <div className="input-group" style={{ maxWidth: '220px' }}>
            <span className="input-group-text bg-transparent border-white border-opacity-10 text-secondary">
              <Search size={16} />
            </span>
            <input
              type="text"
              className="form-control bg-transparent border-white border-opacity-10 text-white"
              placeholder="بحث..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => { setShowCreateModal(true); setCreateError('') }}
            className="btn btn-gold d-flex align-items-center gap-2 px-4 py-2 rounded-3 fw-bold"
          >
            <UserPlus size={16} /> مستخدم جديد
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-dark table-hover align-middle saqr-table mb-0">
          <thead>
            <tr>
              <th className="text-secondary fw-normal pb-3">المستخدم</th>
              <th className="text-secondary fw-normal pb-3">البريد الإلكتروني</th>
              <th className="text-secondary fw-normal pb-3">تاريخ التسجيل</th>
              <th className="text-secondary fw-normal pb-3">الحالة</th>
              <th className="text-secondary fw-normal pb-3 text-end">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="d-flex align-items-center gap-2">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                      style={{
                        width: 36, height: 36,
                        background: 'rgba(212,175,55,0.15)',
                        color: '#d4af37',
                        fontSize: 14
                      }}
                    >
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <span className="text-white fw-medium">{user.name || 'مستخدم غير معروف'}</span>
                  </div>
                </td>
                <td className="text-silver font-monospace small">{user.email}</td>
                <td className="text-silver small">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString('ar-EG') : '-'}
                </td>
                <td>
                  {user.status === 'pending' && (
                    <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 py-1 px-2 d-inline-flex align-items-center gap-1">
                      <Clock size={12} /> معلق
                    </span>
                  )}
                  {user.status === 'active' && (
                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 py-1 px-2 d-inline-flex align-items-center gap-1">
                      <Shield size={12} /> نشط
                    </span>
                  )}
                  {user.status === 'rejected' && (
                    <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 py-1 px-2">
                      مرفوض
                    </span>
                  )}
                </td>
                <td className="text-end">
                  <div className="d-flex justify-content-end gap-2">
                    {user.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(user.id, 'active')}
                          className="btn btn-sm btn-outline-success rounded-pill px-3 py-1 d-flex align-items-center gap-1"
                        >
                          <UserCheck size={14} /> موافقة
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(user.id, 'rejected')}
                          className="btn btn-sm btn-outline-danger rounded-pill px-3 py-1 d-flex align-items-center gap-1"
                        >
                          <UserX size={14} /> رفض
                        </button>
                      </>
                    )}
                    {user.status === 'active' && (
                      <button
                        onClick={() => handleUpdateStatus(user.id, 'rejected')}
                        className="btn btn-sm btn-outline-danger border-opacity-25 rounded-pill px-3 py-1"
                      >
                        إلغاء التفعيل
                      </button>
                    )}
                    {user.status === 'rejected' && (
                      <button
                        onClick={() => handleUpdateStatus(user.id, 'active')}
                        className="btn btn-sm btn-outline-success rounded-pill px-3 py-1"
                      >
                        تفعيل
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center py-5 text-secondary">
                  {searchQuery ? 'لا يوجد نتائج للبحث' : 'لا يوجد مستخدمين حالياً'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .saqr-table { --bs-table-bg: transparent; }
        .saqr-table th { border-bottom: 1px solid rgba(255,255,255,0.1); }
        .saqr-table td { border-bottom: 1px solid rgba(255,255,255,0.05); padding-top: 1rem; padding-bottom: 1rem; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* Create User Modal */}
      {showCreateModal && (
        <div
          className="modal d-block"
          style={{ background: 'rgba(0,0,0,0.8)', zIndex: 9999 }}
          onClick={() => setShowCreateModal(false)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content border-secondary" style={{ background: '#1a1a2e' }}>
              <div className="modal-header border-secondary">
                <h6 className="modal-title text-white fw-bold d-flex align-items-center gap-2">
                  <UserPlus size={18} style={{ color: '#d4af37' }} />
                  إضافة مستخدم جديد
                </h6>
                <button className="btn-close btn-close-white" onClick={() => setShowCreateModal(false)} />
              </div>
              <div className="modal-body">
                {createError && (
                  <div className="alert alert-danger py-2 small mb-3">{createError}</div>
                )}
                <div className="mb-3">
                  <label className="form-label small text-secondary">البريد الإلكتروني *</label>
                  <input
                    className="form-control bg-dark text-white border-secondary"
                    type="email"
                    placeholder="example@email.com"
                    value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small text-secondary">اسم المستخدم</label>
                  <input
                    className="form-control bg-dark text-white border-secondary"
                    placeholder="الاسم الظاهر"
                    value={newUser.username}
                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small text-secondary">كلمة المرور *</label>
                  <input
                    className="form-control bg-dark text-white border-secondary"
                    type="password"
                    placeholder="8 أحرف على الأقل"
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer border-secondary">
                <button
                  className="btn btn-outline-secondary btn-sm px-4"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  إلغاء
                </button>
                <button
                  className="btn btn-gold btn-sm px-4 fw-bold d-flex align-items-center gap-2"
                  onClick={handleCreateUser}
                  disabled={creating}
                >
                  {creating ? (
                    <><Loader2 size={14} className="animate-spin" /> جاري الإنشاء...</>
                  ) : (
                    <><UserPlus size={14} /> إنشاء المستخدم</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UsersManagementTab