import { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Empty, Form, Input, Modal, Result, Segmented, Skeleton, Switch, Table, Tag, Tooltip, message } from 'antd';
import { Building2, ChevronRight, KeyRound, Mail, Pencil, Plus, Power, Search, ShieldCheck, UserCog, Users, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDepartments, getUsers } from '../../api/master.api';
import { assignUserRole, createRole, getPermissions, getRolePermissions, getRoles, getUserRoles, removeUserRole, setRoleActive, updateRole, updateRolePermissions } from '../../api/role.api';
import DepartmentSelect from '../../components/DepartmentSelect';
import { useAuth } from '../../auth/AuthProvider';

const roleLabels = {
  ADMIN: ['Quản trị hệ thống', 'Toàn quyền cấu hình, dữ liệu và phân quyền.'],
  DOCUMENT_CONTROLLER: ['Quản lý tài liệu', 'Quản lý nội dung, bộ phận nhận và trạng thái tài liệu.'],
  EDITOR: ['Biên tập viên', 'Tạo tài liệu, phiên bản và tải file lên.'],
  USER: ['Người dùng', 'Xem, xác nhận, đào tạo và phản hồi tài liệu được giao.']
};
const moduleLabels = { SYSTEM: 'Hệ thống và phân quyền', DOCUMENT: 'Quản lý tài liệu', RECEIPT: 'Tiếp nhận tài liệu', PRODUCT: 'Sản phẩm', REPORT: 'Báo cáo và nhật ký' };
const initials = user => (user?.FullName || user?.Username || '?').split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase();

export default function UserRoleSettingsPage() {
  const qc = useQueryClient();
  const { user: currentUser, hasPermission } = useAuth();
  const canView = hasPermission('RBAC_VIEW');
  const canManage = hasPermission('RBAC_MANAGE');
  const [section, setSection] = useState('users');
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [departmentId, setDepartmentId] = useState();
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm] = Form.useForm();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword.trim()), 350);
    return () => clearTimeout(timer);
  }, [keyword]);

  const usersQuery = useQuery({ queryKey: ['admin-users', debouncedKeyword, departmentId], queryFn: () => getUsers({ keyword: debouncedKeyword || undefined, departmentId }), enabled: canView && section === 'users' });
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: () => getRoles(true), enabled: canView });
  const permissionsQuery = useQuery({ queryKey: ['permissions'], queryFn: getPermissions, enabled: canView });
  const departmentsQuery = useQuery({ queryKey: ['departments'], queryFn: () => getDepartments(''), enabled: canView });
  const userRolesQuery = useQuery({ queryKey: ['user-roles', selectedUser?.UserId], queryFn: () => getUserRoles(selectedUser.UserId), enabled: canView && Boolean(selectedUser?.UserId) });
  const rolePermissionsQuery = useQuery({ queryKey: ['role-permissions', selectedRole?.Id], queryFn: () => getRolePermissions(selectedRole.Id), enabled: canView && Boolean(selectedRole?.Id) });

  useEffect(() => {
    if (section === 'roles' && !selectedRole && rolesQuery.data?.length) setSelectedRole(rolesQuery.data[0]);
  }, [section, selectedRole, rolesQuery.data]);

  const roleMutation = useMutation({
    mutationFn: ({ roleCode, enabled }) => enabled ? assignUserRole(selectedUser.UserId, roleCode) : removeUserRole(selectedUser.UserId, roleCode),
    onSuccess: (_data, variables) => {
      message.success(variables.enabled ? 'Đã gán vai trò cho tài khoản' : 'Đã gỡ vai trò khỏi tài khoản');
      qc.invalidateQueries({ queryKey: ['user-roles', selectedUser.UserId] });
    },
    onError: error => message.error(error.response?.data?.message || error.message)
  });
  const permissionMutation = useMutation({
    mutationFn: ({ permissionCode, enabled }) => {
      const current = new Set((rolePermissionsQuery.data || []).filter(item => item.IsGranted).map(item => item.Code));
      if (enabled) current.add(permissionCode); else current.delete(permissionCode);
      return updateRolePermissions(selectedRole.Id, [...current]);
    },
    onSuccess: data => {
      message.success('Đã cập nhật quyền của vai trò');
      qc.setQueryData(['role-permissions', selectedRole.Id], data);
    },
    onError: error => message.error(error.response?.data?.message || error.message)
  });
  const roleCrudMutation = useMutation({
    mutationFn: values => editingRole ? updateRole(editingRole.Id, values) : createRole(values),
    onSuccess: role => {
      message.success(editingRole ? 'Đã cập nhật vai trò' : 'Đã tạo vai trò mới');
      setRoleModalOpen(false);
      setEditingRole(null);
      roleForm.resetFields();
      setSelectedRole(role);
      qc.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: error => message.error(error.response?.data?.message || error.message)
  });
  const roleActiveMutation = useMutation({
    mutationFn: ({ roleId, isActive }) => setRoleActive(roleId, isActive),
    onSuccess: role => {
      message.success(role.IsActive ? 'Đã kích hoạt vai trò' : 'Đã ngừng hoạt động vai trò');
      setSelectedRole(role);
      qc.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: error => message.error(error.response?.data?.message || error.message)
  });

  const departmentMap = useMemo(() => new Map((departmentsQuery.data || []).map(item => [item.DepartmentId, item.DepartmentName])), [departmentsQuery.data]);
  const activeRoles = useMemo(() => (rolesQuery.data || []).filter(role => role.IsActive), [rolesQuery.data]);
  const ownedRoleCodes = useMemo(() => new Set((userRolesQuery.data || []).map(role => role.Code)), [userRolesQuery.data]);
  const permissionGroups = useMemo(() => {
    const groups = new Map();
    for (const permission of rolePermissionsQuery.data || []) {
      if (!groups.has(permission.Module)) groups.set(permission.Module, []);
      groups.get(permission.Module).push(permission);
    }
    return [...groups.entries()];
  }, [rolePermissionsQuery.data]);
  const permissionModuleCount = useMemo(() => new Set((permissionsQuery.data || []).map(item => item.Module)).size, [permissionsQuery.data]);
  const isSelf = Boolean(selectedUser?.UserId && currentUser?.userId) && Number(selectedUser.UserId) === Number(currentUser.userId);
  const panelOpen = section === 'users' ? Boolean(selectedUser) : Boolean(selectedRole);

  const openCreateRole = () => {
    setEditingRole(null);
    roleForm.resetFields();
    setRoleModalOpen(true);
  };
  const openEditRole = () => {
    setEditingRole(selectedRole);
    roleForm.setFieldsValue({ code: selectedRole.Code, name: selectedRole.Name, description: selectedRole.Description });
    setRoleModalOpen(true);
  };
  const toggleRoleActive = () => {
    const isActivating = !selectedRole.IsActive;
    Modal.confirm({
      title: isActivating ? 'Kích hoạt lại vai trò?' : 'Ngừng hoạt động vai trò?',
      content: isActivating ? 'Vai trò sẽ có thể được gán cho tài khoản.' : 'Vai trò không thể gán mới; dữ liệu và lịch sử cũ vẫn được giữ nguyên.',
      okText: isActivating ? 'Kích hoạt' : 'Ngừng hoạt động',
      okButtonProps: { danger: !isActivating },
      cancelText: 'Hủy',
      onOk: () => roleActiveMutation.mutateAsync({ roleId: selectedRole.Id, isActive: isActivating })
    });
  };

  if (!canView) return <Result status="403" title="Không có quyền truy cập" subTitle="Tài khoản cần quyền xem cấu hình phân quyền." />;

  const columns = [
    { title: 'Tài khoản', key: 'account', render: (_, record) => <div className="settings-user-cell"><Avatar>{initials(record)}</Avatar><div><strong>{record.FullName || record.Username}</strong><span>@{record.Username}</span></div></div> },
    { title: 'Bộ phận', dataIndex: 'DepartmentName', width: 240, render: (value, record) => value || departmentMap.get(record.DepartmentId) || '—' },
    { title: 'Email', dataIndex: 'Email', width: 260, render: value => value || '—' },
    { title: '', width: 44, render: () => <UserCog size={17} className="settings-row-icon" /> }
  ];

  const userContent = <section className="settings-table-card">
    <div className="settings-filters"><Input allowClear prefix={<Search size={17} />} placeholder="Tìm tên hoặc tài khoản..." value={keyword} onChange={event => setKeyword(event.target.value)} /><DepartmentSelect value={departmentId} onChange={setDepartmentId} placeholder="Tất cả bộ phận" /></div>
    <Table rowKey="UserId" loading={usersQuery.isLoading} dataSource={usersQuery.data || []} columns={columns} pagination={{ pageSize: 12, showSizeChanger: false }} rowClassName={record => record.UserId === selectedUser?.UserId ? 'selected-settings-row' : ''} onRow={record => ({ onClick: () => setSelectedUser(record), style: { cursor: 'pointer' } })} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không tìm thấy tài khoản" /> }} />
  </section>;

  const roleContent = <section className="settings-role-card">
    <div className="settings-card-heading"><div><strong>Danh sách vai trò</strong><span>Vai trò ngừng hoạt động được giữ trong lịch sử và không thể gán mới.</span></div><div className="settings-card-actions"><Tag className="role-count-tag">{(rolesQuery.data || []).length} vai trò</Tag>{canManage && <Button className="create-role-button" type="primary" icon={<Plus size={15} />} onClick={openCreateRole}>Tạo vai trò</Button>}</div></div>
    <div className="settings-role-grid">{rolesQuery.isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : (rolesQuery.data || []).map(role => {
      const fallback = roleLabels[role.Code] || [];
      const name = role.Name || fallback[0] || role.Code;
      const description = role.Description || fallback[1];
      return <button type="button" key={role.Id} className={`settings-role-item ${selectedRole?.Id === role.Id ? 'is-selected' : ''} ${!role.IsActive ? 'is-inactive' : ''}`} onClick={() => setSelectedRole(role)}><span className="settings-role-shield"><ShieldCheck size={19} /></span><span><strong>{name}</strong><small>{description || role.Description}</small><span className="settings-role-tags"><Tag>{role.Code}</Tag><Tag color={role.IsActive ? 'green' : 'default'}>{role.IsActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Tag><Tag>{role.UserCount || 0} tài khoản</Tag></span></span><ChevronRight size={18} /></button>;
    })}</div>
  </section>;

  return <div className={`settings-workspace ${panelOpen ? 'has-panel' : ''}`}>
    <main className="settings-main">
      <div className="settings-titlebar"><div><span className="settings-eyebrow"><ShieldCheck size={15} /> QUẢN TRỊ HỆ THỐNG</span><h1>Cấu hình phân quyền</h1><p>Gán nhiều vai trò cho tài khoản và cấu hình tập quyền của từng vai trò.</p></div></div>
      <div className="settings-section-tabs"><Segmented block value={section} onChange={setSection} options={[{ value: 'users', label: 'Tài khoản – Vai trò', icon: <Users size={15} /> }, { value: 'roles', label: 'Vai trò – Quyền', icon: <KeyRound size={15} /> }]} /></div>
      <section className="settings-stats"><div><Users size={20} /><span><strong>{section === 'users' ? (usersQuery.data || []).length : permissionModuleCount}</strong>{section === 'users' ? 'Tài khoản' : 'Nhóm quyền'}</span></div><div><ShieldCheck size={20} /><span><strong>{activeRoles.length}</strong>Vai trò hoạt động</span></div><div><KeyRound size={20} /><span><strong>{(permissionsQuery.data || []).length}</strong>Quyền hệ thống</span></div></section>
      {section === 'users' ? userContent : roleContent}
    </main>

    {section === 'users' && selectedUser && <aside className="role-panel">
      <div className="role-panel-header"><div><span>Vai trò của tài khoản</span><strong>{selectedUser.Username}</strong></div><Button type="text" icon={<X size={20} />} onClick={() => setSelectedUser(null)} /></div>
      <div className="role-user-profile"><Avatar size={54}>{initials(selectedUser)}</Avatar><div><strong>{selectedUser.FullName || selectedUser.Username}</strong><span>@{selectedUser.Username}</span></div></div>
      <div className="role-user-meta"><div><Building2 size={16} /><span>Bộ phận</span><strong>{selectedUser.DepartmentName || departmentMap.get(selectedUser.DepartmentId) || '—'}</strong></div><div><Mail size={16} /><span>Email</span><strong>{selectedUser.Email || '—'}</strong></div></div>
      <div className="role-panel-section-title"><KeyRound size={16} /> Vai trò được gán</div>
      <div className="role-list">{rolesQuery.isLoading || userRolesQuery.isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : activeRoles.map(role => {
        const fallback = roleLabels[role.Code] || [];
        const label = role.Name || fallback[0] || role.Code;
        const description = role.Description || fallback[1];
        const checked = ownedRoleCodes.has(role.Code);
        const selfAdmin = isSelf && role.Code === 'ADMIN' && checked;
        const loading = roleMutation.isPending && roleMutation.variables?.roleCode === role.Code;
        return <div className={`role-option ${checked ? 'is-enabled' : ''}`} key={role.Code}><div className="role-option-icon"><ShieldCheck size={18} /></div><div><strong>{label}</strong><span>{description || role.Description}</span><Tag>{role.Code}</Tag></div><Tooltip title={selfAdmin ? 'Không thể tự gỡ quyền ADMIN của chính mình' : ''}><Switch checked={checked} loading={loading} disabled={!canManage || selfAdmin || roleMutation.isPending} onChange={enabled => roleMutation.mutate({ roleCode: role.Code, enabled })} /></Tooltip></div>;
      })}</div>
      {!canManage && <div className="self-role-warning">Bạn chỉ có quyền xem cấu hình, không thể thay đổi vai trò.</div>}
      {isSelf && <div className="self-role-warning">Quyền ADMIN của tài khoản hiện tại được bảo vệ để tránh tự khóa hệ thống.</div>}
    </aside>}

    {section === 'roles' && selectedRole && <aside className="role-panel permission-panel">
      <div className="role-panel-header"><div><span>Quyền của vai trò</span><strong>{selectedRole.Name || roleLabels[selectedRole.Code]?.[0] || selectedRole.Code}</strong></div></div>
      <div className="permission-role-summary"><span className="settings-role-shield"><ShieldCheck size={22} /></span><div><strong>{selectedRole.Code}</strong><span>{selectedRole.Description}</span></div><Tag color={selectedRole.IsActive ? 'green' : 'default'}>{selectedRole.IsActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Tag></div>
      {canManage && <div className="role-crud-actions"><Button icon={<Pencil size={15} />} onClick={openEditRole}>Sửa vai trò</Button><Button danger={selectedRole.IsActive} icon={<Power size={15} />} loading={roleActiveMutation.isPending} disabled={selectedRole.Code === 'ADMIN'} onClick={toggleRoleActive}>{selectedRole.IsActive ? 'Ngừng hoạt động' : 'Kích hoạt lại'}</Button></div>}
      {selectedRole.Code === 'ADMIN' && <div className="protected-role-note"><ShieldCheck size={16} /><span>ADMIN luôn có toàn bộ quyền và không thể chỉnh sửa tập quyền.</span></div>}
      <div className="permission-groups">{rolePermissionsQuery.isLoading ? <Skeleton active paragraph={{ rows: 10 }} /> : permissionGroups.map(([module, permissions]) => <section key={module} className="permission-group"><h3>{moduleLabels[module] || module}</h3>{permissions.map(permission => {
        const loading = permissionMutation.isPending && permissionMutation.variables?.permissionCode === permission.Code;
        return <div className={`permission-option ${permission.IsGranted ? 'is-granted' : ''}`} key={permission.Code}><div><strong>{permission.Name}</strong><span>{permission.Description}</span><Tag>{permission.Code}</Tag></div><Switch checked={permission.IsGranted} loading={loading} disabled={!canManage || selectedRole.Code === 'ADMIN' || permissionMutation.isPending} onChange={enabled => permissionMutation.mutate({ permissionCode: permission.Code, enabled })} /></div>;
      })}</section>)}</div>
      {!canManage && <div className="self-role-warning">Bạn chỉ có quyền xem, không thể thay đổi tập quyền của vai trò.</div>}
    </aside>}

    <Modal title={editingRole ? 'Sửa vai trò' : 'Tạo vai trò mới'} open={roleModalOpen} onCancel={() => setRoleModalOpen(false)} onOk={() => roleForm.submit()} confirmLoading={roleCrudMutation.isPending} okText={editingRole ? 'Lưu thay đổi' : 'Tạo vai trò'} cancelText="Hủy">
      <Form form={roleForm} layout="vertical" onFinish={roleCrudMutation.mutate} requiredMark={false}>
        <Form.Item name="code" label="Mã vai trò" normalize={value => value?.toUpperCase()} rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập mã vai trò' }, { pattern: /^[A-Z][A-Z0-9_]*$/, message: 'Chỉ dùng chữ in hoa, số và dấu gạch dưới' }]}><Input maxLength={50} disabled={Boolean(editingRole && ['ADMIN', 'DOCUMENT_CONTROLLER', 'EDITOR', 'USER'].includes(editingRole.Code))} placeholder="Ví dụ: QUALITY_MANAGER" /></Form.Item>
        <Form.Item name="name" label="Tên vai trò" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên vai trò' }]}><Input maxLength={200} placeholder="Ví dụ: Quản lý chất lượng" /></Form.Item>
        <Form.Item name="description" label="Mô tả"><Input.TextArea rows={4} maxLength={500} showCount placeholder="Mô tả phạm vi trách nhiệm của vai trò" /></Form.Item>
      </Form>
    </Modal>
  </div>;
}
