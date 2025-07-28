use std::collections::{HashMap, HashSet};
use sqlx::types::Uuid;
use time::OffsetDateTime;

use crate::models::{
    progress::{SkillTree, Skill, SkillCategory, UnlockPath, UnlockType, OverallStats},
    quest::{Quest, UserQuest, QuestStatus, QuestWithProgress},
    nft::BadgeNFT,
};

pub struct SkillTreeService;

impl SkillTreeService {
    /// Generate skill trees based on user progress and completed quests
    pub fn generate_skill_trees(
        completed_quests: &[QuestWithProgress],
        overall_stats: &OverallStats,
    ) -> Vec<SkillTree> {
        let mut skill_trees = Vec::new();

        // Frontend Development Skill Tree
        skill_trees.push(Self::create_frontend_skill_tree(completed_quests, overall_stats));
        
        // Backend Development Skill Tree
        skill_trees.push(Self::create_backend_skill_tree(completed_quests, overall_stats));
        
        // Blockchain Development Skill Tree
        skill_trees.push(Self::create_blockchain_skill_tree(completed_quests, overall_stats));
        
        // Data Structures & Algorithms Skill Tree
        skill_trees.push(Self::create_algorithms_skill_tree(completed_quests, overall_stats));

        skill_trees
    }

    /// Determine if a quest should be unlocked based on prerequisites and user progress
    pub fn is_quest_unlocked(
        quest: &Quest,
        completed_quests: &[QuestWithProgress],
        overall_stats: &OverallStats,
        user_badges: &[BadgeNFT],
    ) -> bool {
        // Check quest prerequisites
        let completed_quest_ids: HashSet<Uuid> = completed_quests
            .iter()
            .map(|q| q.quest.id)
            .collect();

        // All prerequisite quests must be completed
        if !quest.requirements.prerequisites
            .iter()
            .all(|prereq_id| completed_quest_ids.contains(prereq_id))
        {
            return false;
        }

        // Check skill level requirements
        if let Some(required_level) = quest.requirements.skill_level {
            if overall_stats.level < required_level {
                return false;
            }
        }

        // Check minimum badge requirements
        if let Some(min_badges) = quest.requirements.min_badges {
            if user_badges.len() < min_badges as usize {
                return false;
            }
        }

        // Check required skills (simplified - assume skills are unlocked by completing quests)
        let unlocked_skills: HashSet<String> = completed_quests
            .iter()
            .flat_map(|q| q.quest.rewards.skills_unlocked.iter())
            .cloned()
            .collect();

        quest.requirements.skills_required
            .iter()
            .all(|skill| unlocked_skills.contains(skill))
    }

    /// Generate unlock paths showing quest dependencies and progression
    pub fn generate_unlock_paths(
        all_quests: &[Quest],
        completed_quests: &[QuestWithProgress],
        in_progress_quests: &[QuestWithProgress],
        available_quests: &[QuestWithProgress],
    ) -> Vec<UnlockPath> {
        let mut unlock_paths = Vec::new();

        // Create paths from completed quests to their unlocked quests
        for completed in completed_quests {
            for &next_quest_id in &completed.quest.rewards.next_quests {
                unlock_paths.push(UnlockPath {
                    from_quest_id: Some(completed.quest.id),
                    to_quest_id: next_quest_id,
                    unlock_type: UnlockType::QuestCompletion,
                    requirements_met: true,
                    missing_requirements: vec![],
                });
            }
        }

        // Create paths for locked quests showing what's needed to unlock them
        for quest in all_quests {
            if !available_quests.iter().any(|q| q.quest.id == quest.id) &&
               !in_progress_quests.iter().any(|q| q.quest.id == quest.id) &&
               !completed_quests.iter().any(|q| q.quest.id == quest.id) {
                
                let missing_requirements = Self::get_missing_requirements(quest, completed_quests);
                
                for &prereq_id in &quest.requirements.prerequisites {
                    unlock_paths.push(UnlockPath {
                        from_quest_id: Some(prereq_id),
                        to_quest_id: quest.id,
                        unlock_type: UnlockType::QuestCompletion,
                        requirements_met: false,
                        missing_requirements: missing_requirements.clone(),
                    });
                }
            }
        }

        unlock_paths
    }

    fn create_frontend_skill_tree(
        completed_quests: &[QuestWithProgress],
        overall_stats: &OverallStats,
    ) -> SkillTree {
        let frontend_quests: Vec<_> = completed_quests
            .iter()
            .filter(|q| Self::is_frontend_quest(&q.quest))
            .collect();

        let completion_percentage = if frontend_quests.is_empty() {
            0.0
        } else {
            (frontend_quests.len() as f32 / 10.0) * 100.0 // Assume 10 frontend quests total
        };

        let skills = vec![
            Self::create_skill(
                "html",
                "HTML",
                "Hypertext Markup Language fundamentals",
                &frontend_quests,
                vec![],
                true,
            ),
            Self::create_skill(
                "css",
                "CSS",
                "Cascading Style Sheets and responsive design",
                &frontend_quests,
                vec!["html".to_string()],
                frontend_quests.len() >= 1,
            ),
            Self::create_skill(
                "javascript",
                "JavaScript",
                "Modern JavaScript programming",
                &frontend_quests,
                vec!["html".to_string(), "css".to_string()],
                frontend_quests.len() >= 2,
            ),
            Self::create_skill(
                "react",
                "React",
                "React framework and component-based development",
                &frontend_quests,
                vec!["javascript".to_string()],
                frontend_quests.len() >= 4,
            ),
        ];

        SkillTree {
            id: "frontend".to_string(),
            name: "Frontend Development".to_string(),
            description: "Master modern frontend technologies and user interface development".to_string(),
            category: SkillCategory::Frontend,
            skills,
            completion_percentage,
            unlocked_at: if completion_percentage > 0.0 {
                Some(OffsetDateTime::now_utc())
            } else {
                None
            },
        }
    }

    fn create_backend_skill_tree(
        completed_quests: &[QuestWithProgress],
        overall_stats: &OverallStats,
    ) -> SkillTree {
        let backend_quests: Vec<_> = completed_quests
            .iter()
            .filter(|q| Self::is_backend_quest(&q.quest))
            .collect();

        let completion_percentage = if backend_quests.is_empty() {
            0.0
        } else {
            (backend_quests.len() as f32 / 8.0) * 100.0 // Assume 8 backend quests total
        };

        let skills = vec![
            Self::create_skill(
                "rust",
                "Rust",
                "Systems programming with Rust",
                &backend_quests,
                vec![],
                overall_stats.level >= 3,
            ),
            Self::create_skill(
                "databases",
                "Databases",
                "SQL and database design",
                &backend_quests,
                vec![],
                overall_stats.level >= 2,
            ),
            Self::create_skill(
                "apis",
                "API Development",
                "RESTful APIs and web services",
                &backend_quests,
                vec!["rust".to_string(), "databases".to_string()],
                backend_quests.len() >= 2,
            ),
        ];

        SkillTree {
            id: "backend".to_string(),
            name: "Backend Development".to_string(),
            description: "Server-side programming, databases, and API development".to_string(),
            category: SkillCategory::Backend,
            skills,
            completion_percentage,
            unlocked_at: if overall_stats.level >= 2 {
                Some(OffsetDateTime::now_utc())
            } else {
                None
            },
        }
    }

    fn create_blockchain_skill_tree(
        completed_quests: &[QuestWithProgress],
        overall_stats: &OverallStats,
    ) -> SkillTree {
        let blockchain_quests: Vec<_> = completed_quests
            .iter()
            .filter(|q| Self::is_blockchain_quest(&q.quest))
            .collect();

        let completion_percentage = if blockchain_quests.is_empty() {
            0.0
        } else {
            (blockchain_quests.len() as f32 / 6.0) * 100.0 // Assume 6 blockchain quests total
        };

        let skills = vec![
            Self::create_skill(
                "solidity",
                "Solidity",
                "Smart contract development",
                &blockchain_quests,
                vec![],
                overall_stats.level >= 5,
            ),
            Self::create_skill(
                "web3",
                "Web3",
                "Decentralized application development",
                &blockchain_quests,
                vec!["solidity".to_string()],
                blockchain_quests.len() >= 1,
            ),
        ];

        SkillTree {
            id: "blockchain".to_string(),
            name: "Blockchain Development".to_string(),
            description: "Smart contracts and decentralized applications".to_string(),
            category: SkillCategory::Blockchain,
            skills,
            completion_percentage,
            unlocked_at: if overall_stats.level >= 5 {
                Some(OffsetDateTime::now_utc())
            } else {
                None
            },
        }
    }

    fn create_algorithms_skill_tree(
        completed_quests: &[QuestWithProgress],
        overall_stats: &OverallStats,
    ) -> SkillTree {
        let algo_quests: Vec<_> = completed_quests
            .iter()
            .filter(|q| Self::is_algorithms_quest(&q.quest))
            .collect();

        let completion_percentage = if algo_quests.is_empty() {
            0.0
        } else {
            (algo_quests.len() as f32 / 12.0) * 100.0 // Assume 12 algorithm quests total
        };

        let skills = vec![
            Self::create_skill(
                "arrays",
                "Arrays & Strings",
                "Basic data structure manipulation",
                &algo_quests,
                vec![],
                true,
            ),
            Self::create_skill(
                "sorting",
                "Sorting Algorithms",
                "Various sorting techniques and complexity analysis",
                &algo_quests,
                vec!["arrays".to_string()],
                algo_quests.len() >= 2,
            ),
        ];

        SkillTree {
            id: "algorithms".to_string(),
            name: "Data Structures & Algorithms".to_string(),
            description: "Fundamental computer science concepts and problem-solving".to_string(),
            category: SkillCategory::Algorithms,
            skills,
            completion_percentage,
            unlocked_at: Some(OffsetDateTime::now_utc()), // Always available
        }
    }

    fn create_skill(
        id: &str,
        name: &str,
        description: &str,
        related_quests: &[&QuestWithProgress],
        prerequisites: Vec<String>,
        is_unlocked: bool,
    ) -> Skill {
        let level = std::cmp::min(related_quests.len() as u32, 10);
        let experience = related_quests.len() as u32 * 100;

        Skill {
            id: id.to_string(),
            name: name.to_string(),
            description: description.to_string(),
            level,
            max_level: 10,
            experience,
            experience_to_next_level: if level < 10 { 100 } else { 0 },
            is_unlocked,
            unlocked_at: if is_unlocked {
                Some(OffsetDateTime::now_utc())
            } else {
                None
            },
            prerequisites,
            related_quests: related_quests.iter().map(|q| q.quest.id).collect(),
        }
    }

    fn is_frontend_quest(quest: &Quest) -> bool {
        quest.title.to_lowercase().contains("frontend") ||
        quest.title.to_lowercase().contains("html") ||
        quest.title.to_lowercase().contains("css") ||
        quest.title.to_lowercase().contains("javascript") ||
        quest.title.to_lowercase().contains("react")
    }

    fn is_backend_quest(quest: &Quest) -> bool {
        quest.title.to_lowercase().contains("backend") ||
        quest.title.to_lowercase().contains("api") ||
        quest.title.to_lowercase().contains("database") ||
        quest.title.to_lowercase().contains("server")
    }

    fn is_blockchain_quest(quest: &Quest) -> bool {
        quest.title.to_lowercase().contains("blockchain") ||
        quest.title.to_lowercase().contains("solidity") ||
        quest.title.to_lowercase().contains("smart contract") ||
        quest.title.to_lowercase().contains("web3")
    }

    fn is_algorithms_quest(quest: &Quest) -> bool {
        quest.title.to_lowercase().contains("algorithm") ||
        quest.title.to_lowercase().contains("data structure") ||
        quest.title.to_lowercase().contains("sorting") ||
        quest.title.to_lowercase().contains("search")
    }

    fn get_missing_requirements(
        quest: &Quest,
        completed_quests: &[QuestWithProgress],
    ) -> Vec<String> {
        let mut missing = Vec::new();
        let completed_ids: HashSet<Uuid> = completed_quests
            .iter()
            .map(|q| q.quest.id)
            .collect();

        for prereq_id in &quest.requirements.prerequisites {
            if !completed_ids.contains(prereq_id) {
                missing.push(format!("Complete quest: {}", prereq_id));
            }
        }

        missing
    }
}
