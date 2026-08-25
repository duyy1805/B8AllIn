import { Select } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getDepartments } from '../api/master.api';

export default function DepartmentSelect({ value, onChange, style, placeholder = 'Chọn bộ phận', ...selectProps }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => getDepartments('')
  });

  return (
    <Select
      {...selectProps}
      showSearch
      allowClear
      loading={isLoading}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      optionFilterProp="label"
      maxTagCount="responsive"
      style={{ width: '100%', ...style }}
      options={data.map(x => ({
        value: x.DepartmentId,
        label: `${x.DepartmentCode ? `${x.DepartmentCode} - ` : ''}${x.DepartmentName}`
      }))}
    />
  );
}
