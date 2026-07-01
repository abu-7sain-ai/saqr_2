import React, { useState, useEffect } from 'react'
import { UserCheck, UserX, Clock, Search, Shield, Loader2 } from 'lucide-react'
import { supabase } from '../../../services/supabase'

const UsersManagementTab = () => {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])

  useEffect(() => {
    fetchUsers()
  }, [])

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

  if (loading)
    return (
      <div className="d-flex justify-content-center py-5">
        <Loader2 className="animate-spin text-gold" size={40} />
      </div>
    )

  return (
    <div className="animate-fade-in">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h5 className="text-white fw-bold m-0 mb-1">إدارة المستخدمين</h5>
          <p className="text-secondary small m-0">قائمة المسجلين وصلاحيات الدخول لمنصة الصقر</p>
        </div>
        <div className="input-group" style={{ maxWidth: '250px' }}>
          <span className="input-group-text bg-transparent border-white border-opacity-10 text-secondary">
            <Search size={18} />
          </span>
          <input
            type="text"
            className="form-control bg-transparent border-white border-opacity-10 text-white"
            placeholder="بحث..."
          />
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
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="d-flex align-items-center gap-2">
                    <div
                      className="bg-primary bg-opacity-25 rounded-circle d-flex align-items-center justify-content-center text-primary fw-bold"
                      style={{ width: '36px', height: '36px' }}
                    >
                      {user.name?.charAt(0) || 'U'}
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
                  {user.status === 'pending' && (
                    <div className="d-flex justify-content-end gap-2">
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
                    </div>
                  )}
                  {user.status === 'active' && (
                    <button
                      onClick={() => handleUpdateStatus(user.id, 'rejected')}
                      className="btn btn-sm btn-outline-danger border-opacity-10 rounded-pill px-3 py-1"
                    >
                      إلغاء التفعيل
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center py-5 text-secondary">
                  لا يوجد مستخدمين حالياً
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
      `}</style>
    </div>
  )
}

export default UsersManagementTab
