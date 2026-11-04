const { getDB } = require("../config/db");
const { idFromRef, deleteFile } = require("../utils/fileStore");


const EMPLOYMENT_STATUSES = ["Student", "Unemployed - looking for work",
    "Employed - full-time", "Employed - part-time", "Freelancer"];
const EXPERIENCE_LEVELS = ["No experience", "Less than 1 year", "1-3 years", "3-5 years", "5+ years"];
const PROFICIENCY = ["Beginner", "Intermediate", "Advanced", "Expert"];

function pick(value, allowed) {
    return typeof value === "string" && allowed.includes(value) ? value : "";
}

function text(value, max = 300) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// Calculate profile completeness
function calculateProfileCompleteness(profile) {

    const fields = [
        profile.phone,
        profile.location,
        profile.education,
        profile.career,
        profile.track,
        profile.employment_status,
        profile.experience_level,
        profile.skills && profile.skills.length > 0,
        profile.bio,
        profile.profile_image,
        profile.cv
    ];

    const completedFields = fields.filter((field) => {
        if (typeof field === "boolean") {
            return field;
        }

        return field !== null &&
            field !== undefined &&
            field !== "";
    }).length;

    return Math.round(
        (completedFields / fields.length) * 100
    );
}


// Create or update learner profile
async function saveLearnerProfile(req, res) {

    try {

        const db = getDB();
        const userId = req.user.user_id;

        const {
            phone,
            location,
            education,
            career,
            track,
            skills,
            bio
        } = req.body;


        // Check user
        const user = await db.collection("users").findOne({
            user_id: userId
        });

        if (!user) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });

        }


        // Learner access remains available when another role is granted.
        const userRoles = Array.isArray(user.roles) ? user.roles : [];
        const isLearner = userRoles.some(
            role => typeof role === "string" && role.toLowerCase() === "learner"
        ) || user.active_role === "Learner";

        if (!isLearner) {

            return res.status(403).json({
                success: false,
                message: "You are not registered as a Learner"
            });

        }


        // Get existing profile
        const existingProfile =
            await db.collection("learner_profiles").findOne({
                user_id: userId
            });


        // Existing values
        let profileImage =
            existingProfile?.profile_image || null;

        let cv =
            existingProfile?.cv || null;


        // New profile image (stored in MongoDB GridFS by uploadMiddleware)
        const replacedFiles = [];

        if (req.files && req.files.profile_image) {
            replacedFiles.push(profileImage);
            profileImage = req.files.profile_image[0].storedRef;
        }


        // New CV
        if (req.files && req.files.cv) {
            replacedFiles.push(cv);
            cv = req.files.cv[0].storedRef;
        }


        // Convert skills
        let skillsArray = [];

        if (Array.isArray(skills)) {

            skillsArray = skills;

        } else if (typeof skills === "string") {

            skillsArray = skills
                .split(",")
                .map(skill => skill.trim())
                .filter(skill => skill !== "");

        }


        
        skillsArray = [...new Set(
            skillsArray
                .filter(skill => typeof skill === "string")
                .map(skill => skill.trim().slice(0, 40))
                .filter(Boolean)
        )].slice(0, 30);

        
        let skillLevels = { ...(existingProfile?.skill_levels || {}) };
        if (typeof req.body.skill_levels === "string" && req.body.skill_levels) {
            try {
                const parsed = JSON.parse(req.body.skill_levels);
                if (parsed && typeof parsed === "object") skillLevels = parsed;
            } catch { /* ignore malformed input */ }
        }
        skillLevels = Object.fromEntries(
            skillsArray.map(skill => [skill, pick(skillLevels[skill], PROFICIENCY) || "Beginner"])
        );


        // Create profile object
        // Fields not sent keep their saved value, so a client (e.g. a
        // future mobile app) can update just one field or just the photo.
        const sent = name => Object.prototype.hasOwnProperty.call(req.body, name);
        const keep = (name, value) => sent(name) ? value : (existingProfile?.[name] ?? value);

        const profileData = {

            user_id: userId,

            phone: keep("phone", text(phone, 30)),

            location: keep("location", text(location, 120)),

            education: keep("education", text(education, 200)),

            career: keep("career", text(career, 200)),

            track: keep("track", text(track, 80)),

            // FR-10
            employment_status: keep("employment_status", pick(req.body.employment_status, EMPLOYMENT_STATUSES)),

            experience_level: keep("experience_level", pick(req.body.experience_level, EXPERIENCE_LEVELS)),

            skills: sent("skills") ? skillsArray : (existingProfile?.skills || skillsArray),

            // FR-17: proficiency per skill
            skill_levels: sent("skills") || sent("skill_levels")
                ? skillLevels
                : (existingProfile?.skill_levels || skillLevels),

            bio: keep("bio", text(bio, 2000)),

            profile_image: profileImage,

            cv: cv,

            updated_at: new Date()
        };


        // Calculate completeness
        profileData.profile_completed =
            calculateProfileCompleteness(profileData);


        if (existingProfile) {

            
            await db.collection("learner_profiles").updateOne(
                {
                    user_id: userId
                },
                {
                    $set: profileData
                }
            );

        } else {

            // Create new profile
            profileData.created_at = new Date();

            await db.collection("learner_profiles").insertOne(
                profileData
            );

        }


        // Remove the old photo/CV from GridFS now that the new one is saved.
        // Applications keep their own CV reference, so keep CVs that an
        // application still points to.
        for (const ref of replacedFiles) {
            const oldId = idFromRef(ref);
            if (!oldId) continue;
            const usedByApplication = ref.startsWith("gridfs:")
                ? await db.collection("applications").findOne({ cv: ref })
                : null;
            if (!usedByApplication) await deleteFile(oldId);
        }

        return res.status(200).json({

            success: true,

            message:
                "Learner profile saved successfully",

            profile: profileData
        });

    } catch (error) {

        console.error(
            "Save learner profile error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                error.message ||
                "Unable to save learner profile"
        });
    }
}


// PUT /api/learners/skills  { skills: [{ name, level }] }  (FR-17)
async function saveSkills(req, res) {
    try {
        const db = getDB();
        const userId = req.user.user_id;
        const input = Array.isArray(req.body.skills) ? req.body.skills : null;

        if (!input) {
            return res.status(400).json({ success: false, message: "Skills list is required" });
        }

        const seen = new Set();
        const skills = [];
        const skillLevels = {};

        for (const item of input.slice(0, 30)) {
            const name = text(item?.name, 40);
            if (!name || seen.has(name.toLowerCase())) continue;
            seen.add(name.toLowerCase());
            skills.push(name);
            skillLevels[name] = pick(item?.level, PROFICIENCY) || "Beginner";
        }

        const profile = await db.collection("learner_profiles").findOne({ user_id: userId });

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: "Create your learner profile first"
            });
        }

        const updated = { ...profile, skills, skill_levels: skillLevels };

        await db.collection("learner_profiles").updateOne(
            { user_id: userId },
            {
                $set: {
                    skills,
                    skill_levels: skillLevels,
                    profile_completed: calculateProfileCompleteness(updated),
                    updated_at: new Date()
                }
            }
        );

        return res.status(200).json({ success: true, message: "Skills saved", skills, skill_levels: skillLevels });

    } catch (error) {
        console.error("Save skills error:", error);
        return res.status(500).json({ success: false, message: "Unable to save skills" });
    }
}


// Get learner profile
async function getLearnerProfile(req, res) {

    try {

        const db = getDB();
        const userId = req.user.user_id;


        const profile =
            await db.collection("learner_profiles").findOne({
                user_id: userId
            });


        if (!profile) {

            return res.status(404).json({

                success: false,

                message:
                    "Learner profile not found"
            });

        }


        return res.status(200).json({

            success: true,

            profile

        });

    } catch (error) {

        console.error(
            "Get learner profile error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to load learner profile"
        });

    }
}


module.exports = {

    saveLearnerProfile,
    getLearnerProfile,
    saveSkills,
    PROFICIENCY

};