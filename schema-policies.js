/**
 * Database Schema for Candidate Policies
 * Run this to create the candidate_policies table if it doesn't exist
 */

const CANDIDATE_POLICIES_TABLE = `
CREATE TABLE IF NOT EXISTS candidate_policies (
  policy_id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  policy_title VARCHAR(255) NOT NULL,
  policy_description LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id) ON DELETE CASCADE,
  INDEX idx_candidate_id (candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
`;

module.exports = {
  CANDIDATE_POLICIES_TABLE,
  async initializeDatabase(pool) {
    try {
      const connection = await pool.getConnection();
      await connection.query(CANDIDATE_POLICIES_TABLE);
      connection.release();
      console.log('✅ candidate_policies table initialized');
    } catch (error) {
      console.error('❌ Error initializing candidate_policies table:', error);
      throw error;
    }
  }
};
