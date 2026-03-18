import { supabase } from 'src/supabase';

// 테이블별 PK 컬럼명 (기본값 'id', users는 'uid')
const PK_FIELD: Record<string, string> = { users: 'uid' };
const pk = (table: string) => PK_FIELD[table] ?? 'id';

export function useSupabase() {
  async function getAll<T>(tableName: string): Promise<T[]> {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) throw new Error(error.message);
    return (data ?? []) as T[];
  }

  async function getWhere<T>(
    tableName: string,
    field: string,
    _op: string,
    value: unknown,
  ): Promise<T[]> {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq(field, value as string);
    if (error) throw new Error(error.message);
    return (data ?? []) as T[];
  }

  async function create<T extends object>(
    tableName: string,
    data: T,
    id?: string,
  ): Promise<string> {
    const { data: rows, error } = await supabase.from(tableName).insert(data).select();
    if (error) throw new Error(error.message);
    if (id) return id;
    return (rows as Array<{ id: string }>)[0]!.id;
  }

  async function update(
    tableName: string,
    id: string,
    data: Partial<Record<string, unknown>>,
  ): Promise<void> {
    const { error } = await supabase.from(tableName).update(data).eq(pk(tableName), id);
    if (error) throw new Error(error.message);
  }

  async function remove(tableName: string, id: string): Promise<void> {
    const { error } = await supabase.from(tableName).delete().eq(pk(tableName), id);
    if (error) throw new Error(error.message);
  }

  return { getAll, getWhere, create, update, remove };
}
