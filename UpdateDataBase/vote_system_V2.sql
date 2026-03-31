-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 31, 2026 at 03:38 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `vote_system`
--

-- --------------------------------------------------------

--
-- Table structure for table `candidates`
--

CREATE TABLE `candidates` (
  `candidate_id` int(10) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `score` int(10) DEFAULT 0,
  `personal_info` text DEFAULT NULL,
  `policies` text DEFAULT NULL,
  `profile_picture` varchar(255) DEFAULT NULL,
  `name` varchar(100) DEFAULT NULL,
  `is_registered` tinyint(1) DEFAULT 0,
  `term_id` int(10) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `candidates`
--

INSERT INTO `candidates` (`candidate_id`, `user_id`, `score`, `personal_info`, `policies`, `profile_picture`, `name`, `is_registered`, `term_id`) VALUES
(4, 6, 20, NULL, 'Policy 68', NULL, NULL, 0, 2),
(9, NULL, 0, NULL, NULL, NULL, 'นายสมชาย ใจดี', 0, 3),
(10, NULL, 0, NULL, NULL, NULL, 'เด็กชายดี เกินไป', 0, 3);

-- --------------------------------------------------------

--
-- Table structure for table `setting_system`
--

CREATE TABLE `setting_system` (
  `setting_name` varchar(255) NOT NULL,
  `setting_value` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `setting_system`
--

INSERT INTO `setting_system` (`setting_name`, `setting_value`) VALUES
('is_register_enabled', 1),
('is_voting_enabled', 0);

-- --------------------------------------------------------

--
-- Table structure for table `terms`
--

CREATE TABLE `terms` (
  `term_id` int(10) NOT NULL,
  `name` int(10) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `terms`
--

INSERT INTO `terms` (`term_id`, `name`, `description`, `is_active`) VALUES
(2, 2568, 'เลือกตั้งประธานนักศึกษา ปี 2568', 0),
(3, 2569, 'เลือกตั้งประธานนักศึกษา ปี 2569', 1),
(8, 1, 'เลือกตั้งนายกสโมสรนักศึกษา ประจำปีการศึกษา 2569', 0);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(10) NOT NULL,
  `username` varchar(20) NOT NULL,
  `password` varchar(97) NOT NULL,
  `role` enum('admin','candidate','voter') NOT NULL,
  `is_enable` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `username`, `password`, `role`, `is_enable`) VALUES
(1, 'admin01', 'password123', 'admin', 1),
(2, 'Somyom01', '1111', 'candidate', 1),
(3, 'voter01', 'V_1111', 'voter', 1),
(4, 'voter02', 'V_2222', 'voter', 1),
(5, 'voter03', 'V_3333', 'voter', 1),
(6, 'cand_a', '123', 'candidate', 0),
(7, 'voter_a', '123', 'voter', 1),
(11, '1234567890123', '$argon2id$v=19$m=65536,t=3,p=4$RQ5cwJrFGFxihGqZ3HqnDA$q8ugSr7NHAAroY61Dj9MpDkO+NFneid0mYIbbzI4SLY', 'voter', 1),
(12, '12345678901234', '$argon2id$v=19$m=65536,t=3,p=4$csAwf3YHVDGzG/UJv4K7ug$KlAijIeWH5lcoOCHaU69sUY01TDxF6++ed61ALYeISI', 'voter', 1),
(14, '1234567890121', '$argon2id$v=19$m=65536,t=3,p=4$oftqRXt+vl8n92Fj5HIk1g$yqUmS7HHkxD7kohsAHaMXUnSFdxcQHFdflkZEweC5rk', 'voter', 1);

-- --------------------------------------------------------

--
-- Table structure for table `voters`
--

CREATE TABLE `voters` (
  `voter_id` int(10) NOT NULL,
  `user_id` int(10) NOT NULL,
  `is_voted` tinyint(1) DEFAULT 0,
  `term_id` int(10) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `voters`
--

INSERT INTO `voters` (`voter_id`, `user_id`, `is_voted`, `term_id`) VALUES
(6, 7, 1, 2),
(7, 7, 0, 3),
(8, 11, 0, 3),
(9, 12, 0, 3),
(10, 14, 0, 3);

-- --------------------------------------------------------

--
-- Table structure for table `votes`
--

CREATE TABLE `votes` (
  `vote_id` int(10) NOT NULL,
  `voter_id` int(10) NOT NULL,
  `candidate_id` int(10) NOT NULL,
  `voted_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `candidates`
--
ALTER TABLE `candidates`
  ADD PRIMARY KEY (`candidate_id`),
  ADD UNIQUE KEY `user_id_2` (`user_id`,`term_id`),
  ADD KEY `fk_candidates_term` (`term_id`);

--
-- Indexes for table `setting_system`
--
ALTER TABLE `setting_system`
  ADD PRIMARY KEY (`setting_name`);

--
-- Indexes for table `terms`
--
ALTER TABLE `terms`
  ADD PRIMARY KEY (`term_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Indexes for table `voters`
--
ALTER TABLE `voters`
  ADD PRIMARY KEY (`voter_id`),
  ADD UNIQUE KEY `user_id_2` (`user_id`,`term_id`),
  ADD KEY `fk_voters_term` (`term_id`);

--
-- Indexes for table `votes`
--
ALTER TABLE `votes`
  ADD PRIMARY KEY (`vote_id`),
  ADD UNIQUE KEY `voter_id` (`voter_id`),
  ADD KEY `candidate_id` (`candidate_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `candidates`
--
ALTER TABLE `candidates`
  MODIFY `candidate_id` int(10) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `terms`
--
ALTER TABLE `terms`
  MODIFY `term_id` int(10) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(10) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `voters`
--
ALTER TABLE `voters`
  MODIFY `voter_id` int(10) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `votes`
--
ALTER TABLE `votes`
  MODIFY `vote_id` int(10) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `candidates`
--
ALTER TABLE `candidates`
  ADD CONSTRAINT `candidates_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_candidates_term` FOREIGN KEY (`term_id`) REFERENCES `terms` (`term_id`) ON DELETE CASCADE;

--
-- Constraints for table `voters`
--
ALTER TABLE `voters`
  ADD CONSTRAINT `fk_voters_term` FOREIGN KEY (`term_id`) REFERENCES `terms` (`term_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `voters_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `votes`
--
ALTER TABLE `votes`
  ADD CONSTRAINT `votes_ibfk_1` FOREIGN KEY (`voter_id`) REFERENCES `voters` (`voter_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `votes_ibfk_2` FOREIGN KEY (`candidate_id`) REFERENCES `candidates` (`candidate_id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
