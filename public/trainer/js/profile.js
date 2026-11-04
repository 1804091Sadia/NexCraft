// ============================================================
// NEXCRAFT - FULL TRAINER PROFILE
// ============================================================

const token = localStorage.getItem("nexcraft_token");

// ============================================================
// AUTH
// ============================================================

if (!token) {
  window.location.href = "/login.html";
}

// ============================================================
// ELEMENTS
// ============================================================

const form = document.getElementById("trainerProfileForm");

const messageBox = document.getElementById("message");

const saveBtn = document.getElementById("saveBtn");

const logoutBtn = document.getElementById("logoutBtn");

const imageInput = document.getElementById("profile_image");

const photoPreview = document.getElementById("photoPreview");

const trainerAvatar = document.getElementById("trainerAvatar");

const publicAvatar = document.getElementById("publicAvatar");

// FORM INPUTS

const nameInput = document.getElementById("trainer_name");

const emailInput = document.getElementById("trainer_email");

const phoneInput = document.getElementById("phone");

const locationInput = document.getElementById("location");

const designationInput = document.getElementById("designation");

const organizationInput = document.getElementById("organization");

const expertiseInput = document.getElementById("expertise_area");

const experienceInput = document.getElementById("experience_years");

const educationInput = document.getElementById("education");

const linkedinInput = document.getElementById("linkedin");

const websiteInput = document.getElementById("website");

const bioInput = document.getElementById("bio");

const characterCount = document.getElementById("characterCount");

// PREVIEW

const trainerNameHeading = document.getElementById("trainerNameHeading");

const previewName = document.getElementById("previewName");

const previewDesignation = document.getElementById("previewDesignation");

const previewOrganization = document.getElementById("previewOrganization");

const previewExpertise = document.getElementById("previewExpertise");

const previewEmail = document.getElementById("previewEmail");

const previewPhone = document.getElementById("previewPhone");

const previewLocation = document.getElementById("previewLocation");

const previewEducation = document.getElementById("previewEducation");

const previewExperience = document.getElementById("previewExperience");

const previewLinkedin = document.getElementById("previewLinkedin");

const previewWebsite = document.getElementById("previewWebsite");

const previewBio = document.getElementById("previewBio");

// ============================================================
// STATE
// ============================================================

let profileExists = false;

let currentProfileImage = "";

// ============================================================
// MESSAGE
// ============================================================

function showMessage(message, type = "error") {
  messageBox.textContent = message;

  messageBox.className = `profile-message ${type}`;
}

// ============================================================
// CLEAR MESSAGE
// ============================================================

function clearMessage() {
  messageBox.textContent = "";

  messageBox.className = "profile-message";
}

// ============================================================
// INITIAL
// ============================================================

function getInitial(name) {
  const value = String(name || "Trainer").trim();

  return value.charAt(0).toUpperCase() || "T";
}

// ============================================================
// SAFE URL
// ============================================================

function normalizeUrl(value) {
  const url = String(value || "").trim();

  if (!url) {
    return "";
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `https://${url}`;
}

// ============================================================
// EMPTY VALUE
// ============================================================

function setText(element, value, fallback = "—") {
  if (!element) {
    return;
  }

  const cleanValue = String(value || "").trim();

  element.textContent = cleanValue || fallback;

  if (cleanValue) {
    element.classList.remove("empty-value");
  } else {
    element.classList.add("empty-value");
  }
}

// ============================================================
// IMAGE
// ============================================================

function setAvatar(element, name, imageUrl) {
  if (!element) {
    return;
  }

  element.innerHTML = "";

  if (imageUrl) {
    const img = document.createElement("img");

    img.src = imageUrl;

    img.alt = `${name || "Trainer"} profile photo`;

    img.onerror = function () {
      element.textContent = getInitial(name);
    };

    element.appendChild(img);

    return;
  }

  element.textContent = getInitial(name);
}

// ============================================================
// CHARACTER COUNT
// ============================================================

function updateCharacterCount() {
  const length = bioInput.value.length;

  characterCount.textContent = `${length} / 1500`;
}

// ============================================================
// UPDATE PREVIEW
// ============================================================

function updatePreview() {
  const name = nameInput.value.trim();

  const email = emailInput.value.trim();

  const phone = phoneInput.value.trim();

  const location = locationInput.value.trim();

  const designation = designationInput.value.trim();

  const organization = organizationInput.value.trim();

  const expertise = expertiseInput.value.trim();

  const experience = experienceInput.value.trim();

  const education = educationInput.value.trim();

  const linkedin = linkedinInput.value.trim();

  const website = websiteInput.value.trim();

  const bio = bioInput.value.trim();

  // HERO

  trainerNameHeading.textContent = name || "Build your trainer identity";

  // PUBLIC HEADER

  setText(previewName, name, "Trainer Name");

  setText(previewDesignation, designation, "Professional Trainer");

  setText(previewOrganization, organization, "Organization");

  setText(previewExpertise, expertise, "Expertise Area");

  // CONTACT

  setText(previewEmail, email);

  setText(previewPhone, phone);

  setText(previewLocation, location);

  setText(previewEducation, education);

  setText(previewExperience, experience);

  // LINKEDIN

  if (linkedin) {
    const url = normalizeUrl(linkedin);

    previewLinkedin.textContent = "View LinkedIn profile";

    previewLinkedin.href = url;
    previewLinkedin.removeAttribute("aria-disabled");
    previewLinkedin.removeAttribute("tabindex");

    previewLinkedin.classList.remove("empty-value");
  } else {
    previewLinkedin.textContent = "—";

    // Empty: not a link (a "#" link opened a blank tab)
    previewLinkedin.removeAttribute("href");
    previewLinkedin.setAttribute("aria-disabled", "true");
    previewLinkedin.setAttribute("tabindex", "-1");

    previewLinkedin.classList.add("empty-value");
  }

  // WEBSITE

  if (website) {
    const url = normalizeUrl(website);

    previewWebsite.textContent = "Visit website";

    previewWebsite.href = url;
    previewWebsite.removeAttribute("aria-disabled");
    previewWebsite.removeAttribute("tabindex");

    previewWebsite.classList.remove("empty-value");
  } else {
    previewWebsite.textContent = "—";

    // Empty: not a link (a "#" link opened a blank tab)
    previewWebsite.removeAttribute("href");
    previewWebsite.setAttribute("aria-disabled", "true");
    previewWebsite.setAttribute("tabindex", "-1");

    previewWebsite.classList.add("empty-value");
  }

  // BIO

  setText(previewBio, bio, "Your professional bio will appear here.");

  // AVATARS

  setAvatar(trainerAvatar, name, currentProfileImage);

  setAvatar(publicAvatar, name, currentProfileImage);

  setAvatar(photoPreview, name, currentProfileImage);
}

// ============================================================
// LOAD PROFILE
// ============================================================

async function loadTrainerProfile() {
  clearMessage();

  try {
    const response = await fetch("/api/trainers/profile", {
      method: "GET",

      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    // ----------------------------------------
    // AUTH ERROR
    // ----------------------------------------

    if (response.status === 401) {
      localStorage.removeItem("nexcraft_token");

      window.location.href = "/login.html";

      return;
    }

    // ----------------------------------------
    // PROFILE EXISTS
    // ----------------------------------------

    if (response.ok && data.success && data.trainer) {
      const trainer = data.trainer;

      profileExists = true;

      // BASIC

      nameInput.value = trainer.name || "";

      emailInput.value = trainer.email || "";

      // PROFESSIONAL

      phoneInput.value = trainer.phone || "";

      locationInput.value = trainer.location || "";

      designationInput.value = trainer.designation || "";

      organizationInput.value = trainer.organization || "";

      expertiseInput.value = trainer.expertise_area || "";

      experienceInput.value = trainer.experience_years || "";

      educationInput.value = trainer.education || "";

      linkedinInput.value = trainer.linkedin || "";

      websiteInput.value = trainer.website || "";

      bioInput.value = trainer.bio || "";

      currentProfileImage = trainer.profile_image || "";

      saveBtn.textContent = "✓ Update Profile";

      updateCharacterCount();

      updatePreview();

      return;
    }

    // ----------------------------------------
    // PROFILE NOT CREATED
    // ----------------------------------------

    if (response.status === 404) {
      profileExists = false;

      if (data.user) {
        nameInput.value = data.user.name || "";

        emailInput.value = data.user.email || "";

        phoneInput.value = data.user.phone || "";
      }

      saveBtn.textContent = "✓ Create Profile";

      updateCharacterCount();

      updatePreview();

      return;
    }

    // ----------------------------------------
    // OTHER ERROR
    // ----------------------------------------

    showMessage(data.message || "Unable to load trainer profile.");
  } catch (error) {
    console.error("Load trainer profile error:", error);

    showMessage("Unable to connect to the server.");
  }
}

// ============================================================
// IMAGE PREVIEW
// ============================================================

imageInput.addEventListener("change", function () {
  const file = imageInput.files[0];

  if (!file) {
    return;
  }

  // ----------------------------------------
  // TYPE
  // ----------------------------------------

  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];

  if (!allowedTypes.includes(file.type)) {
    showMessage("Please choose a JPG, JPEG or PNG image.");

    imageInput.value = "";

    return;
  }

  // ----------------------------------------
  // SIZE
  // ----------------------------------------

  if (file.size > 5 * 1024 * 1024) {
    showMessage("Profile image must be smaller than 5 MB.");

    imageInput.value = "";

    return;
  }

  clearMessage();

  const reader = new FileReader();

  reader.onload = function (event) {
    currentProfileImage = event.target.result;

    updatePreview();
  };

  reader.readAsDataURL(file);
});

// ============================================================
// SAVE PROFILE
// ============================================================

form.addEventListener("submit", async function (event) {
  event.preventDefault();

  clearMessage();

  const name = nameInput.value.trim();

  const expertise = expertiseInput.value.trim();

  // ----------------------------------------
  // REQUIRED VALIDATION
  // ----------------------------------------

  if (!name) {
    showMessage("Please enter your full name.");

    nameInput.focus();

    return;
  }

  if (!expertise) {
    showMessage("Please enter your main expertise area.");

    expertiseInput.focus();

    return;
  }

  // ----------------------------------------
  // BUTTON
  // ----------------------------------------

  saveBtn.disabled = true;

  saveBtn.textContent = "Saving...";

  try {
    const formData = new FormData();

    formData.append("name", name);

    formData.append("phone", phoneInput.value.trim());

    formData.append("location", locationInput.value.trim());

    formData.append("designation", designationInput.value.trim());

    formData.append("organization", organizationInput.value.trim());

    formData.append("expertise_area", expertise);

    formData.append("experience_years", experienceInput.value.trim());

    formData.append("education", educationInput.value.trim());

    formData.append("linkedin", linkedinInput.value.trim());

    formData.append("website", websiteInput.value.trim());

    formData.append("bio", bioInput.value.trim());

    if (imageInput.files && imageInput.files.length > 0) {
      formData.append("profile_image", imageInput.files[0]);
    }

    const method = profileExists ? "PUT" : "POST";

    const response = await fetch("/api/trainers/profile", {
      method,

      headers: {
        Authorization: `Bearer ${token}`,
      },

      body: formData,
    });

    const data = await response.json();

    // ----------------------------------------
    // AUTH ERROR
    // ----------------------------------------

    if (response.status === 401) {
      localStorage.removeItem("nexcraft_token");

      window.location.href = "/login.html";

      return;
    }

    // ----------------------------------------
    // ERROR
    // ----------------------------------------

    if (!response.ok || !data.success) {
      showMessage(data.message || "Failed to save trainer profile.");

      return;
    }

    // ----------------------------------------
    // SUCCESS
    // ----------------------------------------

    profileExists = true;

    if (data.trainer) {
      currentProfileImage = data.trainer.profile_image || currentProfileImage;

      emailInput.value = data.trainer.email || emailInput.value;
    }

    imageInput.value = "";

    updateCharacterCount();

    updatePreview();

    showMessage(
      data.message || "Trainer profile saved successfully.",
      "success",
    );
  } catch (error) {
    console.error("Save trainer profile error:", error);

    showMessage("Unable to connect to the server.");
  } finally {
    saveBtn.disabled = false;

    saveBtn.textContent = profileExists
      ? "✓ Update Profile"
      : "✓ Create Profile";
  }
});

// ============================================================
// LIVE EVENTS
// ============================================================

const previewInputs = [
  nameInput,

  phoneInput,

  locationInput,

  designationInput,

  organizationInput,

  expertiseInput,

  experienceInput,

  educationInput,

  linkedinInput,

  websiteInput,
];

previewInputs.forEach((input) => {
  input.addEventListener("input", updatePreview);
});

bioInput.addEventListener("input", function () {
  updateCharacterCount();

  updatePreview();
});

// ============================================================
// LOGOUT
// ============================================================

logoutBtn.addEventListener("click", function () {
  localStorage.removeItem("nexcraft_token");

  window.location.href = "/login.html";
});

// ============================================================
// PAGE LOAD
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  loadTrainerProfile();
});
