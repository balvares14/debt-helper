const pool = require('../db');
const logger = require('../utils/logger');

class DatabaseService {
  /**
   * Test database connection
   * @returns {Promise<object>} - Connection test result
   */
  static async testConnection() {
    try {
      logger.logDatabase('connection_test_started');
      const client = await pool.connect();
      
      const result = await client.query('SELECT NOW() as current_time, version() as db_version');
      
      client.release();
      
      logger.logDatabase('connection_test_success', {
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
      });
      
      return {
        success: true,
        data: {
          currentTime: result.rows[0].current_time,
          dbVersion: result.rows[0].db_version,
          connectionInfo: {
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT
          }
        }
      };
    } catch (error) {
      logger.logError(error, {
        operation: 'database_connection_test',
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
      });
      
      return {
        success: false,
        error: error.message,
        connectionInfo: {
          host: process.env.DB_HOST,
          database: process.env.DB_NAME,
          port: process.env.DB_PORT
        }
      };
    }
  }

  /**
   * Insert item into miscellaneous table
   * @param {string} title - Item title
   * @param {object} data - Item data (JSONB)
   * @returns {Promise<object>} - Insert result
   */
  static async insertMiscellaneousItem(title, data) {
    try {
      const client = await pool.connect();
      
      const result = await client.query(
        'INSERT INTO miscellaneous (title, data) VALUES ($1, $2) RETURNING *',
        [title, data]
      );
      
      client.release();
      
      return {
        success: true,
        data: result.rows[0]
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all items from miscellaneous table
   * @param {number} limit - Maximum number of items to return
   * @returns {Promise<object>} - Query result
   */
  static async getMiscellaneousItems(limit = 50) {
    try {
      const client = await pool.connect();
      
      const result = await client.query(
        'SELECT * FROM miscellaneous ORDER BY created_at DESC LIMIT $1',
        [limit]
      );
      
      client.release();
      
      return {
        success: true,
        data: result.rows
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Whether this user has a named permission (demo `permissions` table).
   * @param {string} userId
   * @param {string} permission
   * @returns {Promise<{success: boolean, allowed?: boolean, error?: string}>}
   */
  static async hasPermission(userId, permission) {
    const result = await DatabaseService.query(
      'SELECT 1 FROM permissions WHERE user_id = $1 AND permission = $2 LIMIT 1',
      [userId, permission]
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, allowed: result.rowCount > 0 };
  }

  /**
   * List permission names granted to this user.
   * @param {string} userId
   * @returns {Promise<{success: boolean, permissions?: string[], error?: string}>}
   */
  static async listPermissions(userId) {
    const result = await DatabaseService.query(
      'SELECT permission FROM permissions WHERE user_id = $1 ORDER BY permission',
      [userId]
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      permissions: result.rows.map((row) => row.permission)
    };
  }

  /**
   * Grant a named permission. Demo helper for InsertItem; real apps restrict who can grant.
   * @param {string} userId
   * @param {string} permission
   * @returns {Promise<{success: boolean, granted?: boolean, error?: string}>}
   */
  static async grantPermission(userId, permission) {
    const result = await DatabaseService.query(
      `INSERT INTO permissions (user_id, permission)
       VALUES ($1, $2)
       ON CONFLICT (user_id, permission) DO NOTHING
       RETURNING permission`,
      [userId, permission]
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, granted: result.rowCount > 0 };
  }

  /**
   * Generic query method for executing SQL queries
   * @param {string} query - SQL query string
   * @param {Array} params - Query parameters
   * @returns {Promise<object>} - Query result
   */
  static async query(query, params = []) {
    try {
      const client = await pool.connect();
      
      const result = await client.query(query, params);
      
      client.release();
      
      return {
        success: true,
        rows: result.rows,
        rowCount: result.rowCount
      };
    } catch (error) {
      logger.logError(error, {
        operation: 'database_query',
        query: query,
        params: params
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = DatabaseService;
