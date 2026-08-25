import { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Empty, Input, Result, Skeleton, Switch, Table, Tag, Tooltip, message } from 'antd';
import { Building2, KeyRound, Mail, Search, ShieldCheck, UserCog, Users, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDepartments, getUsers } from '../../api/master.api';
import { assignUserRole, getRoles, getUserRoles, removeUserRole } from '../../api/role.api';
import DepartmentSelect from '../../components/DepartmentSelect';
import { useAuth } from '../../auth/AuthProvider';

const roleLabels = {
  ADMIN: ['Quản trị hệ thống', 'Toàn quyền cấu hình, dữ liệu và phân quyền.'],
  DOCUMENT_CONTROLLER: ['Kiểm soát tài liệu', 'Quản lý phiên bản, bộ phận nhận và phát hành tài liệu.'],
  EDITOR: ['Biên tập viên', 'Tạo quy trình, phiên bản và tải tài liệu lên.'],
  REVIEWER: ['Người kiểm tra', 'Kiểm tra nội dung tài liệu trong luồng nghiệp vụ.'],
  APPROVER: ['Người phê duyệt', 'Phê duyệt tài liệu trong luồng nghiệp vụ.'],
  DEPARTMENT_MANAGER: ['Quản lý bộ phận', 'Theo dõi việc tiếp nhận tài liệu của bộ phận.'],
  USER: ['Người dùng', 'Xem, xác nhận và phản hồi tài liệu được phân phối.'],
  AUDITOR: ['Kiểm toán viên', 'Xem lịch sử phiên bản, tiếp nhận và nhật ký hệ thống.']
};

const initials = user => (user?.FullName || user?.Username || '?')
  .split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase();

export default function UserRoleSettingsPage() {
  const qc = useQueryClient();
  const { user: currentUser, hasRole } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [departmentId, setDepartmentId] = useState();
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword.trim()), 350);
    return () => clearTimeout(timer);
  }, [keyword]);

  const usersQuery = useQuery({
    queryKey: ['admin-users', debouncedKeyword, departmentId],
    queryFn: () => getUsers({ keyword: debouncedKeyword || undefined, departmentId }),
    enabled: hasRole('ADMIN')
  });
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: getRoles, enabled: hasRole('ADMIN') });
  const departmentsQuery = useQuery({ queryKey: ['departments'], queryFn: () => getDepartments(''), enabled: hasRole('ADMIN') });
  const userRolesQuery = useQuery({
    queryKey: ['user-roles', selectedUser?.UserId],
    queryFn: () => getUserRoles(selectedUser.UserId),
    enabled: hasRole('ADMIN') && Boolean(selectedUser?.UserId)
  });

  const roleMutation = useMutation({
    mutationFn: ({ roleCode, enabled }) => enabled
      ? assignUserRole(selectedUser.UserId, roleCode)
      : removeUserRole(selectedUser.UserId, roleCode),
    onSuccess: (_data, variables) => {
      message.success(variables.enabled ? 'Đã cấp quyền cho tài khoản' : 'Đã gỡ quyền khỏi tài khoản');
      qc.invalidateQueries({ queryKey: ['user-roles', selectedUser.UserId] });
    },
    onError: error => message.error(error.response?.data?.message || error.message)
  });

  const departmentMap = useMemo(() => new Map(
    (departmentsQuery.data || []).map(item => [item.DepartmentId, item.DepartmentName])
  ), [departmentsQuery.data]);
  const ownedRoleCodes = useMemo(() => new Set((userRolesQuery.data || []).map(role => role.Code)), [userRolesQuery.data]);
  const isSelf = Boolean(selectedUser?.UserId && currentUser?.userId)
    && Number(selectedUser.UserId) === Number(currentUser.userId);

  if (!hasRole('ADMIN')) {
    return <Result status="403" title="Không có quyền truy cập" subTitle="Chỉ quản trị viên mới được cấu hình phân quyền tài khoản." />;
  }

  const columns = [
    {
      title: 'Tài khoản', key: 'account',
      render: (_, record) => <div className="settings-user-cell"><Avatar>{initials(record)}</Avatar><div><strong>{record.FullName || record.Username}</strong><span>@{record.Username}</span></div></div>
    },
    { title: 'Bộ phận', dataIndex: 'DepartmentId', width: 240, render: value => departmentMap.get(value) || `Bộ phận ${value || '—'}` },
    { title: 'Email', dataIndex: 'Email', width: 260, render: value => value || '—' },
    { title: '', width: 44, render: () => <UserCog size={17} className="settings-row-icon" /> }
  ];

  return <div className={`settings-workspace ${selectedUser ? 'has-panel' : ''}`}>
    <main className="settings-main">
      <div className="settings-titlebar"><div><span className="settings-eyebrow"><ShieldCheck size={15} /> QUẢN TRỊ HỆ THỐNG</span><h1>Cấu hình phân quyền</h1><p>Quản lý vai trò và phạm vi thao tác của từng tài khoản.</p></div></div>
      <section className="settings-stats">
        <div><Users size={20} /><span><strong>{(usersQuery.data || []).length}</strong>Tài khoản</span></div>
        <div><KeyRound size={20} /><span><strong>{(rolesQuery.data || []).length}</strong>Vai trò hệ thống</span></div>
      </section>
      <section className="settings-table-card">
        <div className="settings-filters">
          <Input allowClear prefix={<Search size={17} />} placeholder="Tìm tên hoặc tài khoản..." value={keyword} onChange={event => setKeyword(event.target.value)} />
          <DepartmentSelect value={departmentId} onChange={setDepartmentId} placeholder="Tất cả bộ phận" />
        </div>
        <Table
          rowKey="UserId"
          loading={usersQuery.isLoading}
          dataSource={usersQuery.data || []}
          columns={columns}
          pagination={{ pageSize: 12, showSizeChanger: false }}
          rowClassName={record => record.UserId === selectedUser?.UserId ? 'selected-settings-row' : ''}
          onRow={record => ({ onClick: () => setSelectedUser(record), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không tìm thấy tài khoản" /> }}
        />
      </section>
    </main>

    {selectedUser && <aside className="role-panel">
      <div className="role-panel-header"><div><span>Phân quyền tài khoản</span><strong>{selectedUser.Username}</strong></div><Button type="text" icon={<X size={20} />} onClick={() => setSelectedUser(null)} /></div>
      <div className="role-user-profile"><Avatar size={54}>{initials(selectedUser)}</Avatar><div><strong>{selectedUser.FullName || selectedUser.Username}</strong><span>@{selectedUser.Username}</span></div></div>
      <div className="role-user-meta"><div><Building2 size={16} /><span>Bộ phận</span><strong>{departmentMap.get(selectedUser.DepartmentId) || '—'}</strong></div><div><Mail size={16} /><span>Email</span><strong>{selectedUser.Email || '—'}</strong></div></div>
      <div className="role-panel-section-title"><KeyRound size={16} /> Vai trò được cấp</div>
      <div className="role-list">
        {rolesQuery.isLoading || userRolesQuery.isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : (rolesQuery.data || []).map(role => {
          const [label, description] = roleLabels[role.Code] || [role.Name, role.Description];
          const checked = ownedRoleCodes.has(role.Code);
          const selfAdmin = isSelf && role.Code === 'ADMIN' && checked;
          const loading = roleMutation.isPending && roleMutation.variables?.roleCode === role.Code;
          return <div className={`role-option ${checked ? 'is-enabled' : ''}`} key={role.Code}><div className="role-option-icon"><ShieldCheck size={18} /></div><div><strong>{label}</strong><span>{description || role.Description}</span><Tag>{role.Code}</Tag></div><Tooltip title={selfAdmin ? 'Không thể tự gỡ quyền ADMIN của chính mình' : ''}><Switch checked={checked} loading={loading} disabled={selfAdmin || roleMutation.isPending} onChange={enabled => roleMutation.mutate({ roleCode: role.Code, enabled })} /></Tooltip></div>;
        })}
      </div>
      {isSelf && <div className="self-role-warning">Bạn đang cấu hình tài khoản đăng nhập hiện tại. Quyền ADMIN được bảo vệ để tránh tự khóa tài khoản.</div>}
    </aside>}
  </div>;
}
