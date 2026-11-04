const token =
    localStorage.getItem("nexcraft_token");


if (!token) {

    window.location.href =
        "/login.html";
}


const form =
    document.getElementById(
        "editProfileForm"
    );

const saveButton =
    document.getElementById(
        "saveProfileButton"
    );

const messageBox =
    document.getElementById(
        "message"
    );

const profileImageInput =
    document.getElementById(
        "profile_image"
    );

const profilePreview =
    document.getElementById(
        "profilePreview"
    );


// Show message
function showMessage(message, type) {

    messageBox.textContent =
        message;

    messageBox.className =
        `alert alert-${type}`;

    messageBox.style.display =
        "block";
}


// Load user
async function loadUser() {

    try {

        const response =
            await fetch(
                "/api/auth/me",
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            localStorage.removeItem(
                "nexcraft_token"
            );

            window.location.href =
                "/login.html";

            return;
        }


        const user =
            data.user;


        const userRoles = Array.isArray(user.roles)
            ? user.roles
            : [];
        const isLearner = userRoles.some(
            role => typeof role === "string" && role.toLowerCase() === "learner"
        ) || user.active_role === "Learner";

        if (!isLearner) {

            window.location.href =
                "/role-selection.html";

            return;
        }


        document.getElementById(
            "userName"
        ).textContent =
            user.name;


        document.getElementById(
            "userEmail"
        ).textContent =
            user.email;


        document.getElementById(
            "profileInitial"
        ).textContent =
            user.name
                ? user.name
                    .charAt(0)
                    .toUpperCase()
                : "L";


    } catch (error) {

        console.error(
            "User loading error:",
            error
        );

        showMessage(
            "Unable to load user information.",
            "error"
        );

    }
}


// Load existing profile
async function loadProfile() {

    try {

        const response =
            await fetch(
                "/api/learners/profile",
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        if (response.status === 404) {
            return;
        }


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to load profile"
            );

        }


        const profile =
            data.profile;


        document.getElementById(
            "phone"
        ).value =
            profile.phone || "";


        document.getElementById(
            "location"
        ).value =
            profile.location || "";


        document.getElementById(
            "education"
        ).value =
            profile.education || "";


        document.getElementById(
            "career"
        ).value =
            profile.career || "";


        document.getElementById(
            "track"
        ).value =
            profile.track || "";


        document.getElementById("employment_status").value =
            profile.employment_status || "";

        document.getElementById("experience_level").value =
            profile.experience_level || "";


        document.getElementById(
            "skills"
        ).value =
            Array.isArray(profile.skills)
                ? profile.skills.join(", ")
                : "";


        document.getElementById(
            "bio"
        ).value =
            profile.bio || "";


        updateCompletion(
            profile.profile_completed || 0
        );


        // Existing profile image
        if (profile.profile_image) {

            profilePreview.innerHTML = `

                <img
                    src="${profile.profile_image}"
                    alt="Profile Image"
                    style="
                        width:100%;
                        height:100%;
                        object-fit:cover;
                    "
                >

            `;

        }


        // Existing CV
        if (profile.cv) {

            document.getElementById(
                "currentCV"
            ).innerHTML = `

                <a
                    href="#"
                data-cv="me"
                    class="btn btn-secondary"
                >
                    View Current CV
                </a>

            `;

        }


    } catch (error) {

        console.error(
            "Profile loading error:",
            error
        );

        showMessage(
            "Unable to load learner profile.",
            "error"
        );

    }
}


// Completion
function updateCompletion(value) {

    document.getElementById(
        "completionBar"
    ).style.width =
        `${value}%`;


    document.getElementById(
        "completionText"
    ).textContent =
        `${value}%`;
}


// Image preview
profileImageInput.addEventListener(
    "change",
    function () {

        const file =
            this.files[0];


        if (!file) {
            return;
        }


        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/jpg"
        ];


        if (
            !allowedTypes.includes(
                file.type
            )
        ) {

            showMessage(
                "Please select JPG, JPEG or PNG.",
                "error"
            );

            this.value = "";

            return;
        }


        if (
            file.size >
            5 * 1024 * 1024
        ) {

            showMessage(
                "Profile image must be smaller than 5 MB.",
                "error"
            );

            this.value = "";

            return;
        }


        const reader =
            new FileReader();


        reader.onload =
            function (event) {

                profilePreview.innerHTML = `

                    <img
                        src="${event.target.result}"
                        alt="Profile Preview"
                        style="
                            width:100%;
                            height:100%;
                            object-fit:cover;
                        "
                    >

                `;

            };


        reader.readAsDataURL(file);

    }
);


// Save profile
form.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        saveButton.disabled =
            true;

        saveButton.textContent =
            "Saving...";


        try {

            const formData =
                new FormData(form);


            const response =
                await fetch(
                    "/api/learners/profile",
                    {
                        method: "PUT",

                        headers: {
                            "Authorization":
                                `Bearer ${token}`
                        },

                        body: formData
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Unable to update profile"
                );

            }


            showMessage(
                "Profile updated successfully.",
                "success"
            );


            updateCompletion(
                data.profile.profile_completed
            );


            setTimeout(
                function () {

                    window.location.href =
                        "/learner/profile.html";

                },
                800
            );


        } catch (error) {

            console.error(
                "Profile update error:",
                error
            );

            showMessage(
                error.message ||
                "Unable to update profile.",
                "error"
            );


            saveButton.disabled =
                false;

            saveButton.textContent =
                "Save Changes";

        }

    }
);


// Start
loadUser();
loadProfile();