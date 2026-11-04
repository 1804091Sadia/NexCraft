// ========================================
// NEXCRAFT - TRAINER CONTROLLER
// ========================================

const { getDB } = require("../config/db");

// ========================================
// HELPERS
// ========================================

function clean(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function normalizeUrl(value) {
  const url = clean(value);

  if (!url) {
    return "";
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return `https://${url}`;
  }

  return url;
}

function isValidUrl(value) {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    return false;
  }
}

// ========================================
// GET TRAINER PROFILE
// ========================================

async function getTrainerProfile(req, res) {
  try {
    const db = getDB();

    const userId = req.user.user_id;

    // ----------------------------------------
    // USER
    // ----------------------------------------

    const user = await db.collection("users").findOne(
      {
        user_id: userId,
      },
      {
        projection: {
          _id: 0,
          user_id: 1,
          name: 1,
          email: 1,
          phone: 1,
        },
      },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ----------------------------------------
    // TRAINER PROFILE
    // ----------------------------------------

    const trainer = await db.collection("trainer_profiles").findOne(
      {
        user_id: userId,
      },
      {
        projection: {
          _id: 0,
        },
      },
    );

    // ----------------------------------------
    // PROFILE DOES NOT EXIST
    // ----------------------------------------

    if (!trainer) {
      return res.status(404).json({
        success: false,

        message: "Trainer profile not found",

        user: {
          user_id: user.user_id,
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || "",
        },
      });
    }

    // ----------------------------------------
    // RETURN COMPLETE PROFILE
    // ----------------------------------------

    return res.status(200).json({
      success: true,

      trainer: {
        ...trainer,

        name: user.name || trainer.name || "",

        email: user.email || "",

        account_phone: user.phone || "",
      },
    });
  } catch (error) {
    console.error("Get trainer profile error:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load trainer profile",
    });
  }
}

// ========================================
// CREATE TRAINER PROFILE
// ========================================

async function createTrainerProfile(req, res) {
  try {
    const db = getDB();

    const userId = req.user.user_id;

    // ----------------------------------------
    // USER
    // ----------------------------------------

    const user = await db.collection("users").findOne({
      user_id: userId,
    });

    if (!user) {
      return res.status(404).json({
        success: false,

        message: "User not found",
      });
    }

    // ----------------------------------------
    // BODY
    // ----------------------------------------

    const name = clean(req.body.name);

    const phone = clean(req.body.phone);

    const location = clean(req.body.location);

    const designation = clean(req.body.designation);

    const organization = clean(req.body.organization);

    const expertise_area = clean(req.body.expertise_area);

    const experience_years = clean(req.body.experience_years);

    const education = clean(req.body.education);

    const linkedin = normalizeUrl(req.body.linkedin);

    const website = normalizeUrl(req.body.website);

    const bio = clean(req.body.bio);

    // ----------------------------------------
    // VALIDATION
    // ----------------------------------------

    if (!name) {
      return res.status(400).json({
        success: false,

        message: "Name is required",
      });
    }

    if (!expertise_area) {
      return res.status(400).json({
        success: false,

        message: "Expertise area is required",
      });
    }

    if (!isValidUrl(linkedin)) {
      return res.status(400).json({
        success: false,

        message: "Please enter a valid LinkedIn URL",
      });
    }

    if (!isValidUrl(website)) {
      return res.status(400).json({
        success: false,

        message: "Please enter a valid website URL",
      });
    }

    // ----------------------------------------
    // CHECK EXISTING PROFILE
    // ----------------------------------------

    const existingTrainer = await db.collection("trainer_profiles").findOne({
      user_id: userId,
    });

    if (existingTrainer) {
      return res.status(409).json({
        success: false,

        message: "Trainer profile already exists",
      });
    }

    // ----------------------------------------
    // PROFILE IMAGE
    // ----------------------------------------

    let profileImage = "";

    if (req.file) {
      profileImage = req.file.storedRef; // MongoDB GridFS (see uploadMiddleware)
    }

    // ----------------------------------------
    // CREATE PROFILE
    // ----------------------------------------

    const trainerProfile = {
      user_id: userId,

      phone,

      location,

      designation,

      organization,

      expertise_area,

      experience_years,

      education,

      linkedin,

      website,

      bio,

      profile_image: profileImage,

      created_at: new Date(),

      updated_at: new Date(),
    };

    await db.collection("trainer_profiles").insertOne(trainerProfile);

    // ----------------------------------------
    // UPDATE USER NAME
    // ----------------------------------------

    await db.collection("users").updateOne(
      {
        user_id: userId,
      },
      {
        $set: {
          name,
          updated_at: new Date(),
        },
      },
    );

    return res.status(201).json({
      success: true,

      message: "Trainer profile created successfully",

      trainer: {
        ...trainerProfile,

        name,

        email: user.email || "",
      },
    });
  } catch (error) {
    console.error("Create trainer profile error:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to create trainer profile",
    });
  }
}

// ========================================
// UPDATE TRAINER PROFILE
// ========================================

async function updateTrainerProfile(req, res) {
  try {
    const db = getDB();

    const userId = req.user.user_id;

    // ----------------------------------------
    // USER
    // ----------------------------------------

    const user = await db.collection("users").findOne({
      user_id: userId,
    });

    if (!user) {
      return res.status(404).json({
        success: false,

        message: "User not found",
      });
    }

    // ----------------------------------------
    // BODY
    // ----------------------------------------

    const name = clean(req.body.name);

    const phone = clean(req.body.phone);

    const location = clean(req.body.location);

    const designation = clean(req.body.designation);

    const organization = clean(req.body.organization);

    const expertise_area = clean(req.body.expertise_area);

    const experience_years = clean(req.body.experience_years);

    const education = clean(req.body.education);

    const linkedin = normalizeUrl(req.body.linkedin);

    const website = normalizeUrl(req.body.website);

    const bio = clean(req.body.bio);

    // ----------------------------------------
    // VALIDATION
    // ----------------------------------------

    if (!name) {
      return res.status(400).json({
        success: false,

        message: "Name is required",
      });
    }

    if (!expertise_area) {
      return res.status(400).json({
        success: false,

        message: "Expertise area is required",
      });
    }

    if (!isValidUrl(linkedin)) {
      return res.status(400).json({
        success: false,

        message: "Please enter a valid LinkedIn URL",
      });
    }

    if (!isValidUrl(website)) {
      return res.status(400).json({
        success: false,

        message: "Please enter a valid website URL",
      });
    }

    // ----------------------------------------
    // EXISTING PROFILE
    // ----------------------------------------

    const existingTrainer = await db.collection("trainer_profiles").findOne({
      user_id: userId,
    });

    if (!existingTrainer) {
      return res.status(404).json({
        success: false,

        message: "Trainer profile not found",
      });
    }

    // ----------------------------------------
    // PROFILE IMAGE
    // ----------------------------------------

    let profileImage = existingTrainer.profile_image || "";

    if (req.file) {
      profileImage = req.file.storedRef; // MongoDB GridFS (see uploadMiddleware)
    }

    // ----------------------------------------
    // UPDATE TRAINER PROFILE
    // ----------------------------------------

    await db.collection("trainer_profiles").updateOne(
      {
        user_id: userId,
      },
      {
        $set: {
          phone,

          location,

          designation,

          organization,

          expertise_area,

          experience_years,

          education,

          linkedin,

          website,

          bio,

          profile_image: profileImage,

          updated_at: new Date(),
        },
      },
    );

    // ----------------------------------------
    // UPDATE USER NAME
    // ----------------------------------------

    await db.collection("users").updateOne(
      {
        user_id: userId,
      },
      {
        $set: {
          name,

          updated_at: new Date(),
        },
      },
    );

    // ----------------------------------------
    // GET UPDATED PROFILE
    // ----------------------------------------

    const updatedTrainer = await db.collection("trainer_profiles").findOne(
      {
        user_id: userId,
      },
      {
        projection: {
          _id: 0,
        },
      },
    );

    return res.status(200).json({
      success: true,

      message: "Trainer profile updated successfully",

      trainer: {
        ...updatedTrainer,

        name,

        email: user.email || "",
      },
    });
  } catch (error) {
    console.error("Update trainer profile error:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to update trainer profile",
    });
  }
}

// ========================================
// GET TRAINER DASHBOARD
// ========================================

async function getTrainerDashboard(req, res) {
  try {
    const db = getDB();

    const userId = req.user.user_id;

    // ----------------------------------------
    // TRAINER PROFILE
    // ----------------------------------------

    const trainer = await db.collection("trainer_profiles").findOne(
      {
        user_id: userId,
      },
      {
        projection: {
          _id: 0,
          user_id: 1,
          expertise_area: 1,
          bio: 1,
          profile_image: 1,
          designation: 1,
          organization: 1,
        },
      },
    );

    if (!trainer) {
      return res.status(404).json({
        success: false,

        message: "Trainer profile not found",
      });
    }

    // ----------------------------------------
    // PROGRAMS
    // ----------------------------------------

    const programs = await db
      .collection("training_programs")
      .find({
        $or: [
          {
            trainer_id: userId,
          },
          {
            user_id: userId,
          },
        ],
      })
      .toArray();

    // ----------------------------------------
    // PROGRAM STATISTICS
    // ----------------------------------------

    const totalPrograms = programs.length;

    const draftPrograms = programs.filter(
      (program) => String(program.status || "").toLowerCase() === "draft",
    ).length;

    const pendingPrograms = programs.filter(
      (program) =>
        String(program.status || "").toLowerCase() === "pending_approval",
    ).length;

    const activePrograms = programs.filter(
      (program) => String(program.status || "").toLowerCase() === "active",
    ).length;

    const closedPrograms = programs.filter(
      (program) => String(program.status || "").toLowerCase() === "closed",
    ).length;

    // ----------------------------------------
    // PROGRAM IDS
    // ----------------------------------------

    const programIds = programs
      .map((program) => program.program_id)
      .filter(Boolean);

    // ----------------------------------------
    // ENROLLMENTS
    // ----------------------------------------

    let enrollments = [];

    if (programIds.length > 0) {
      enrollments = await db
        .collection("enrollments")
        .find({
          program_id: {
            $in: programIds,
          },
        })
        .toArray();
    }

    const totalEnrollments = enrollments.length;

    const enrolledCount = enrollments.filter(
      (enrollment) =>
        String(enrollment.status || "").toLowerCase() === "enrolled",
    ).length;

    const inProgressCount = enrollments.filter(
      (enrollment) =>
        String(enrollment.status || "").toLowerCase() === "in progress",
    ).length;

    const completedCount = enrollments.filter(
      (enrollment) =>
        String(enrollment.status || "").toLowerCase() === "completed",
    ).length;

    // ----------------------------------------
    // RECENT PROGRAMS
    // ----------------------------------------

    const recentPrograms = programs
      .sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at || 0);

        const dateB = new Date(b.updated_at || b.created_at || 0);

        return dateB - dateA;
      })
      .slice(0, 5)
      .map((program) => ({
        program_id: program.program_id,

        title: program.title || "Untitled Program",

        category: program.category || "",

        mode: program.mode || "",

        status: program.status || "Draft",

        duration: program.duration || "",

        enrollment_count: enrollments.filter(
          (enrollment) => enrollment.program_id === program.program_id,
        ).length,
      }));

    // ----------------------------------------
    // USER
    // ----------------------------------------

    const user = await db.collection("users").findOne(
      {
        user_id: userId,
      },
      {
        projection: {
          _id: 0,
          name: 1,
          email: 1,
        },
      },
    );

    // ----------------------------------------
    // RESPONSE
    // ----------------------------------------

    return res.status(200).json({
      success: true,

      trainer: {
        ...trainer,

        name: user?.name || "",

        email: user?.email || "",
      },

      statistics: {
        programs: {
          total: totalPrograms,

          draft: draftPrograms,

          pending_approval: pendingPrograms,

          active: activePrograms,

          closed: closedPrograms,
        },

        enrollments: {
          total: totalEnrollments,

          enrolled: enrolledCount,

          in_progress: inProgressCount,

          completed: completedCount,
        },
      },

      recent_programs: recentPrograms,
    });
  } catch (error) {
    console.error("Get trainer dashboard error:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load trainer dashboard",
    });
  }
}

// ========================================
// EXPORT
// ========================================

module.exports = {
  getTrainerProfile,

  createTrainerProfile,

  updateTrainerProfile,

  getTrainerDashboard,
};
