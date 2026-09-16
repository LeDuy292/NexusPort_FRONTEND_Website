import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function CarrierStaffManagement() {
  const [staffs, setStaffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    fullName: '',
    password: ''
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchStaffs();
  }, []);

  const fetchStaffs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).token : null;
      const response = await axios.get('/api/users/carrier-staff', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && response.data.data && response.data.data.staffs) {
        setStaffs(response.data.data.staffs);
      } else if (response.data && response.data.staffs) {
        setStaffs(response.data.staffs);
      }
    } catch (error) {
      console.error('Lỗi khi tải danh sách nhân viên:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const token = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).token : null;
      await axios.post('/api/users/carrier-staff', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowModal(false);
      setFormData({ username: '', email: '', fullName: '', password: '' });
      fetchStaffs();
    } catch (error) {
      console.error('Lỗi khi tạo nhân viên:', error);
      const msg = error.response?.data?.message || error.message || 'Có lỗi xảy ra khi tạo tài khoản.';
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).token : null;
      if (currentStatus) {
        await axios.patch(`/api/users/${id}/deactivate`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.patch(`/api/users/${id}/activate`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      fetchStaffs();
    } catch (error) {
      console.error('Lỗi khi thay đổi trạng thái:', error);
      alert(error.response?.data?.message || 'Có lỗi xảy ra khi thay đổi trạng thái.');
      setLoading(false);
    }
  };

  return (
    <div className="p-8 w-full font-sans flex flex-col gap-6 h-screen overflow-y-auto bg-fog/30">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-white rounded-xl p-6 border border-chalk shadow-sm">
        <div>
          <h2 className="font-heading text-2xl font-bold text-carbon">Quản lý Nhân viên</h2>
          <p className="text-sm text-slate mt-1">Tạo và quản lý các tài khoản phụ cho công ty vận tải của bạn</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-carbon text-white font-bold py-2.5 px-6 rounded-lg shadow-md hover:bg-black transition flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Thêm Nhân viên
        </button>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-xl border border-chalk shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-fog border-b border-chalk text-slate font-bold">
              <tr>
                <th className="p-4">Tên đăng nhập</th>
                <th className="p-4">Họ và tên</th>
                <th className="p-4">Email</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4">Ngày tạo</th>
                <th className="p-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate">Đang tải dữ liệu...</td>
                </tr>
              ) : staffs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate">Chưa có nhân viên nào.</td>
                </tr>
              ) : (
                staffs.map((staff) => (
                  <tr key={staff.id} className="hover:bg-fog/50 transition">
                    <td className="p-4 font-bold text-carbon">{staff.username}</td>
                    <td className="p-4 text-graphite">{staff.fullName || '-'}</td>
                    <td className="p-4 text-graphite">{staff.email}</td>
                    <td className="p-4">
                      {staff.isActive ? (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">Hoạt động</span>
                      ) : (
                        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">Đã khóa</span>
                      )}
                    </td>
                    <td className="p-4 text-slate text-xs">
                      {new Date(staff.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleToggleStatus(staff.id, staff.isActive)}
                        className={`px-3 py-1 rounded text-xs font-bold text-white transition ${staff.isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                      >
                        {staff.isActive ? 'Khóa' : 'Mở khóa'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-carbon text-white p-5 flex justify-between items-center">
              <h3 className="font-heading font-bold text-xl">Thêm Nhân viên mới</h3>
              <button onClick={() => setShowModal(false)} className="text-white hover:text-signal-orange">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
              {formError && (
                <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm font-bold border border-red-200">
                  {formError}
                </div>
              )}
              
              <div className="flex flex-col gap-1">
                <label className="text-sm font-bold text-carbon">Tên đăng nhập <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="username"
                  required
                  value={formData.username}
                  onChange={handleInputChange}
                  className="border border-chalk rounded-lg p-2.5 focus:border-carbon focus:ring-1 focus:ring-carbon outline-none transition"
                  placeholder="Nhập tên đăng nhập"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-bold text-carbon">Họ và tên</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className="border border-chalk rounded-lg p-2.5 focus:border-carbon focus:ring-1 focus:ring-carbon outline-none transition"
                  placeholder="Nhập họ và tên nhân viên"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-bold text-carbon">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="border border-chalk rounded-lg p-2.5 focus:border-carbon focus:ring-1 focus:ring-carbon outline-none transition"
                  placeholder="name@company.com"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-bold text-carbon">Mật khẩu <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={handleInputChange}
                  className="border border-chalk rounded-lg p-2.5 focus:border-carbon focus:ring-1 focus:ring-carbon outline-none transition"
                  placeholder="Nhập mật khẩu (ít nhất 6 ký tự)"
                />
              </div>

              <div className="mt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-slate font-bold hover:text-carbon transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="bg-signal-orange text-white font-bold px-6 py-2.5 rounded-lg shadow-md hover:bg-orange-600 transition disabled:opacity-50"
                >
                  {formLoading ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
