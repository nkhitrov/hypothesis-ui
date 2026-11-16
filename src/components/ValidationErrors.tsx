interface Props {
  errors: string[];
  compact?: boolean;
}

/** Список ошибок валидации/парсинга — единый вид во всех точках входа. */
export function ValidationErrors({ errors, compact = false }: Props) {
  if (errors.length === 0) return null;
  return (
    <ul className={compact ? 'error-list compact' : 'error-list'}>
      {errors.map((e, i) => (
        <li key={i}>{e}</li>
      ))}
    </ul>
  );
}
