use duckdb::{Connection, Row};

use crate::error::Result;
use crate::model::user_view::{CreateUserView, UpdateUserView, UserView};

fn map_row(row: &Row<'_>) -> duckdb::Result<UserView> {
    Ok(UserView {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        entity_type: row.get(3)?,
        filters: row.get(4)?,
        sort_config: row.get(5)?,
        columns: row.get(6)?,
        is_default: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

const SELECT: &str = "SELECT id, name, description, entity_type, filters,
                             sort_config, columns, is_default,
                             CAST(created_at AS VARCHAR),
                             CAST(updated_at AS VARCHAR)
                      FROM user_view";

pub(crate) fn list(conn: &Connection, entity_type: Option<&str>) -> Result<Vec<UserView>> {
    let (sql, param): (String, Option<&str>) = if let Some(et) = entity_type {
        (
            format!("{SELECT} WHERE entity_type = ? ORDER BY is_default DESC, updated_at DESC"),
            Some(et),
        )
    } else {
        (
            format!("{SELECT} ORDER BY is_default DESC, updated_at DESC"),
            None,
        )
    };

    let mut stmt = conn.prepare(&sql)?;
    let rows = if let Some(p) = param {
        stmt.query_map([p], map_row)?
    } else {
        stmt.query_map([], map_row)?
    };
    Ok(rows.collect::<duckdb::Result<Vec<_>>>()?)
}

pub(crate) fn find_by_id(conn: &Connection, id: &str) -> Result<Option<UserView>> {
    let sql = format!("{SELECT} WHERE id = ?");
    let mut stmt = conn.prepare(&sql)?;
    let mut rows = stmt.query_map([id], map_row)?;
    Ok(rows.next().transpose()?)
}

pub(crate) fn create(conn: &Connection, view: &CreateUserView) -> Result<UserView> {
    let filters = view.filters.as_deref().unwrap_or("{}");
    conn.execute(
        "INSERT INTO user_view
            (id, name, description, entity_type, filters, sort_config, columns, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        duckdb::params![
            view.id,
            view.name,
            view.description,
            view.entity_type,
            filters,
            view.sort_config,
            view.columns,
            view.is_default,
        ],
    )?;
    // If this view is set as default, clear default on all others in the same entity_type.
    if view.is_default {
        conn.execute(
            "UPDATE user_view SET is_default = false, updated_at = now()
             WHERE entity_type = ? AND id <> ?",
            duckdb::params![view.entity_type, view.id],
        )?;
    }
    Ok(find_by_id(conn, &view.id)?.expect("just inserted"))
}

pub(crate) fn update(conn: &Connection, id: &str, patch: &UpdateUserView) -> Result<Option<UserView>> {
    // Build SET clause dynamically from non-None patch fields.
    let mut sets: Vec<String> = vec!["updated_at = now()".to_string()];
    let mut params: Vec<Box<dyn duckdb::ToSql>> = Vec::new();

    if let Some(ref v) = patch.name {
        sets.push("name = ?".to_string());
        params.push(Box::new(v.clone()));
    }
    if let Some(ref v) = patch.description {
        sets.push("description = ?".to_string());
        params.push(Box::new(v.clone()));
    }
    if let Some(ref v) = patch.filters {
        sets.push("filters = ?".to_string());
        params.push(Box::new(v.clone()));
    }
    if let Some(ref v) = patch.sort_config {
        sets.push("sort_config = ?".to_string());
        params.push(Box::new(v.clone()));
    }
    if let Some(ref v) = patch.columns {
        sets.push("columns = ?".to_string());
        params.push(Box::new(v.clone()));
    }
    if let Some(v) = patch.is_default {
        sets.push("is_default = ?".to_string());
        params.push(Box::new(v));
    }

    let sql = format!("UPDATE user_view SET {} WHERE id = ?", sets.join(", "));
    params.push(Box::new(id.to_string()));

    let refs: Vec<&dyn duckdb::ToSql> = params.iter().map(|b| b.as_ref()).collect();
    let affected = conn.execute(&sql, refs.as_slice())?;
    if affected == 0 {
        return Ok(None);
    }

    // If newly set as default, clear other defaults in the same entity_type.
    if patch.is_default == Some(true) {
        if let Some(ref view) = find_by_id(conn, id)? {
            conn.execute(
                "UPDATE user_view SET is_default = false, updated_at = now()
                 WHERE entity_type = ? AND id <> ?",
                duckdb::params![view.entity_type, id],
            )?;
        }
    }

    find_by_id(conn, id)
}

pub(crate) fn delete(conn: &Connection, id: &str) -> Result<bool> {
    let affected = conn.execute("DELETE FROM user_view WHERE id = ?", [id])?;
    Ok(affected > 0)
}
