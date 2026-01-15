import { getDatabase } from "./index.js";

export interface DataError {
  id: number;
  table_name: string;
  record_id: string;
  error_type: string;
  error_message: string;
  raw_data: string | null;  // JSON string or NULL
  metadata: string | null;  // JSON string or NULL
  timestamp: string;
}

export function getDataErrors(
  tableName?: string,
  errorType?: string
): DataError[] {
  const db = getDatabase();
  let query = "SELECT * FROM DataErrors WHERE 1=1";
  const params: string[] = [];

  if (tableName) {
    query += " AND table_name = ?";
    params.push(tableName);
  }

  if (errorType) {
    query += " AND error_type = ?";
    params.push(errorType);
  }

  query += " ORDER BY timestamp DESC LIMIT 1000";  // Limit to recent 1000 errors

  return db.prepare(query).all(...params) as DataError[];
}
