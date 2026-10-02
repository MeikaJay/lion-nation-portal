import fs from "fs";
import { createClient } from "@supabase/supabase-js";

// =========================================================
// LION NATION AEP ACCOUNT SETUP
// =========================================================
//
// IMPORTANT:
// DRY_RUN = true means PREVIEW ONLY.
// Nothing in Supabase Auth will be changed.
//
// Later, after we verify the preview, we will change this
// to false and run the real account setup.
// =========================================================

const DRY_RUN = true;

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("");
  console.error("MISSING SUPABASE SETTINGS");
  console.error(
    "Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env.local."
  );
  console.error("");

  process.exit(1);
}

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// =========================================================
// HELPERS
// =========================================================

function cleanLetters(value = "") {
  return value.replace(/[^a-zA-Z]/g, "");
}

function createPasswordPrefix(firstName, lastName) {
  const firstTwo = cleanLetters(firstName).slice(0, 2);
  const lastTwo = cleanLetters(lastName).slice(0, 2);

  const formattedFirst =
    firstTwo.charAt(0).toUpperCase() +
    firstTwo.slice(1).toLowerCase();

  const formattedLast =
    lastTwo.charAt(0).toUpperCase() +
    lastTwo.slice(1).toLowerCase();

  return `${formattedFirst}${formattedLast}`;
}

function getUniqueTwoDigitNumber(usedNumbers) {
  const availableNumbers = [];

  for (let number = 10; number <= 99; number += 1) {
    if (!usedNumbers.has(number)) {
      availableNumbers.push(number);
    }
  }

  if (availableNumbers.length === 0) {
    throw new Error(
      "No unused two-digit password numbers remain."
    );
  }

  const randomIndex = Math.floor(
    Math.random() * availableNumbers.length
  );

  const selectedNumber =
    availableNumbers[randomIndex];

  usedNumbers.add(selectedNumber);

  return selectedNumber;
}

function csvSafe(value) {
  const text = String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

// =========================================================
// ACCOUNT SETUP
// =========================================================

async function setupAccounts() {
  console.log("");
  console.log("========================================");
  console.log("LION NATION AEP ACCOUNT SETUP");
  console.log("========================================");

  if (DRY_RUN) {
    console.log("");
    console.log("MODE: PREVIEW ONLY");
    console.log("NO AUTH ACCOUNTS WILL BE CHANGED.");
  } else {
    console.log("");
    console.log("MODE: LIVE ACCOUNT SETUP");
  }

  console.log("");

  // -------------------------------------------------------
  // GET CURRENT AEP ROSTER
  // -------------------------------------------------------

  const {
    data: people,
    error: peopleError,
  } = await supabase
    .from("aep_people")
    .select(`
      id,
      auth_user_id,
      first_name,
      last_name,
      username,
      role,
      aep_target,
      is_active,
      team_id,
      aep_teams (
        team_name
      )
    `)
    .eq("is_active", true)
    .in("role", ["agent", "leader"])
    .order("last_name", {
      ascending: true,
    });

  if (peopleError) {
    throw peopleError;
  }

  if (!people || people.length === 0) {
    throw new Error(
      "No active AEP agents or leaders were found."
    );
  }

  console.log(
    `Found ${people.length} active agents/leaders.`
  );

  console.log("");

  // -------------------------------------------------------
  // COUNTERS
  // -------------------------------------------------------

  let previewUpdateCount = 0;
  let previewCreateCount = 0;

  let updatedCount = 0;
  let createdCount = 0;
  let failedCount = 0;

  const usedNumbers = new Set();
  const loginSheet = [];

  // -------------------------------------------------------
  // PROCESS EACH CURRENT AEP USER
  // -------------------------------------------------------

  for (const person of people) {
    try {
      const username =
        person.username
          ?.trim()
          .toLowerCase();

      if (!username) {
        throw new Error(
          `No username assigned to ${person.first_name} ${person.last_name}`
        );
      }

      // User enters only the username on the website.
      // Internally Supabase Auth will use username@lion.com.

      const loginEmail =
        `${username}@lion.com`;

      // Create password:
      // first 2 letters of first name
      // first 2 letters of last name
      // unique 2-digit number
      // !

      const passwordNumber =
        getUniqueTwoDigitNumber(usedNumbers);

      const password =
        `${createPasswordPrefix(
          person.first_name,
          person.last_name
        )}${passwordNumber}!`;

      let authUserId =
        person.auth_user_id;

      // ===================================================
      // PREVIEW MODE
      // ===================================================

      if (DRY_RUN) {
        if (authUserId) {
          previewUpdateCount += 1;

          console.log(
            `PREVIEW UPDATE: ${person.first_name} ${person.last_name} (${username}) → ${loginEmail}`
          );
        } else {
          previewCreateCount += 1;

          console.log(
            `PREVIEW CREATE: ${person.first_name} ${person.last_name} (${username}) → ${loginEmail}`
          );
        }

        loginSheet.push({
          firstName: person.first_name,
          lastName: person.last_name,
          username,
          password,
          role: person.role,
          team:
            person.aep_teams?.team_name ?? "",
          target:
            person.role === "agent"
              ? person.aep_target ?? ""
              : "Team Total",
        });

        continue;
      }

      // ===================================================
      // LIVE MODE: EXISTING AUTH ACCOUNT
      // ===================================================

      if (authUserId) {
        const {
          data: updatedUser,
          error: updateError,
        } =
          await supabase.auth.admin.updateUserById(
            authUserId,
            {
              email: loginEmail,
              password,
              email_confirm: true,

              user_metadata: {
                username,
                first_name:
                  person.first_name,
                last_name:
                  person.last_name,
                role:
                  person.role,
              },
            }
          );

        if (updateError) {
          throw updateError;
        }

        authUserId =
          updatedUser.user.id;

        updatedCount += 1;

        console.log(
          `UPDATED: ${person.first_name} ${person.last_name} (${username})`
        );
      }

      // ===================================================
      // LIVE MODE: NEW AUTH ACCOUNT
      // ===================================================

      else {
        const {
          data: newUser,
          error: createError,
        } =
          await supabase.auth.admin.createUser({
            email: loginEmail,
            password,
            email_confirm: true,

            user_metadata: {
              username,
              first_name:
                person.first_name,
              last_name:
                person.last_name,
              role:
                person.role,
            },
          });

        if (createError) {
          throw createError;
        }

        authUserId =
          newUser.user.id;

        // Connect the newly created Auth user
        // back to the AEP roster.

        const {
          error: connectError,
        } = await supabase
          .from("aep_people")
          .update({
            auth_user_id:
              authUserId,
          })
          .eq(
            "id",
            person.id
          );

        if (connectError) {
          throw connectError;
        }

        createdCount += 1;

        console.log(
          `CREATED: ${person.first_name} ${person.last_name} (${username})`
        );
      }

      // ---------------------------------------------------
      // ADD USER TO PRIVATE LOGIN SHEET
      // ---------------------------------------------------

      loginSheet.push({
        firstName:
          person.first_name,

        lastName:
          person.last_name,

        username,

        password,

        role:
          person.role,

        team:
          person.aep_teams?.team_name ?? "",

        target:
          person.role === "agent"
            ? person.aep_target ?? ""
            : "Team Total",
      });
    } catch (error) {
      failedCount += 1;

      console.error(
        `FAILED: ${person.first_name} ${person.last_name}`
      );

      console.error(
        `REASON: ${error.message}`
      );

      console.error("");
    }
  }

  // =======================================================
  // CREATE LOGIN SHEET
  // =======================================================

  const header = [
    "First Name",
    "Last Name",
    "Username",
    "Password",
    "Role",
    "Team",
    "AEP Target",
  ];

  const rows =
    loginSheet.map((person) => [
      person.firstName,
      person.lastName,
      person.username,
      person.password,
      person.role,
      person.team,
      person.target,
    ]);

  const csv = [
    header,
    ...rows,
  ]
    .map((row) =>
      row
        .map(csvSafe)
        .join(",")
    )
    .join("\n");

  const fileName =
    DRY_RUN
      ? "AEP-Login-Sheet-PREVIEW.csv"
      : "AEP-Login-Sheet.csv";

  fs.writeFileSync(
    fileName,
    csv,
    "utf8"
  );

  // =======================================================
  // SUMMARY
  // =======================================================

  console.log("");
  console.log("========================================");

  if (DRY_RUN) {
    console.log("PREVIEW COMPLETE");
  } else {
    console.log("ACCOUNT SETUP COMPLETE");
  }

  console.log("========================================");
  console.log("");

  if (DRY_RUN) {
    console.log(
      `Existing accounts that WOULD be updated: ${previewUpdateCount}`
    );

    console.log(
      `New accounts that WOULD be created:      ${previewCreateCount}`
    );
  } else {
    console.log(
      `Existing accounts updated: ${updatedCount}`
    );

    console.log(
      `New accounts created:      ${createdCount}`
    );
  }

  console.log(
    `Failed accounts:           ${failedCount}`
  );

  console.log(
    `Login records:             ${loginSheet.length}`
  );

  console.log("");

  if (DRY_RUN) {
    console.log(
      `Preview login sheet created: ${fileName}`
    );

    console.log("");
    console.log(
      "IMPORTANT: This was only a preview."
    );

    console.log(
      "No Supabase Auth users were created or changed."
    );
  } else {
    console.log(
      `Private login sheet created: ${fileName}`
    );

    console.log("");
    console.log(
      "Keep this CSV private because it contains passwords."
    );
  }

  console.log("");

  if (failedCount > 0) {
    console.log(
      "There were failed accounts. Do not continue until we review them."
    );

    console.log("");
  }
}

// =========================================================
// RUN
// =========================================================

setupAccounts().catch((error) => {
  console.error("");
  console.error("SETUP STOPPED");
  console.error(error);
  console.error("");

  process.exit(1);
});