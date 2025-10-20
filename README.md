This project is built on Node.js/TypeScript that performs three main steps:

1.  **Extracts** baby name data from a Kaggle dataset using **Playwright** (web scraping).
2.  **Stores** the data into a **MySQL** database using **Sequelize ORM**.
3.  **Synchronizes** the stored data to **HubSpot CRM** as contact records via the HubSpot API.

## Project Setup and Initialization

### 1\. Prerequisites 🛠️

Ensure you have the following installed on your machine:

  * **Node.js** (v18+ recommended)
  * **MySQL Server** (Running locally or accessible)
  * **HubSpot Developer Account** (For API Token)
  * **Kaggle Account** (For login credentials)

### 2\. Installation Steps

1.  **Clone the repository:**

    ```bash
    git clone [YOUR-REPO-URL]
    cd EMMA-ASSIGNMENT
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

    *(This installs Playwright, Sequelize, dotenv, axios, and other required libraries.)*

3.  **Install Playwright browser binaries:**

    ```bash
    npx playwright install
    ```

### 3\. Environment Configuration

Create a file named **`.env`** in the root directory and add your credentials and configuration details:

```env
# --- KAGGLE CREDENTIALS (For Web Scraping) ---
KAGGLE_EMAIL="your_kaggle_email"
KAGGLE_PASSWORD="your_kaggle_password"

# --- DATABASE CONFIGURATION (MySQL) ---
MYSQL_PASSWORD="your_mysql_root_password"

# --- HUBSPOT API (For CRM Sync) ---
# Generate a Private App Access Token in your HubSpot Developer Account
HUBSPOT_API_TOKEN="your_hubspot_private_app_access_token"
```

-----

## Execution Guide

The pipeline runs in three sequential phases: **Database Setup**, **Data Scraping & Storage**, and **CRM Synchronization**.

### Phase 1: Database Setup (Migrations)

You must set up the MySQL database and create the required table structure first.

1.  **Create the Database:** Manually create an empty database named `robot_db` in your MySQL server.
2.  **Run Migrations:** Execute the Sequelize migration script to create the `BabyNames` table.
    ```bash
    npx sequelize-cli db:migrate
    ```

### Phase 2: Data Scraping and Storage (scraper.ts)

This script uses Playwright to log in to Kaggle, download the data, and insert it into your local MySQL database.

  * **File:** `src/scraper.ts`
  * **Action:** Fetches the data and performs bulk insert into the `BabyNames` table.
  * **Run:**
    ```bash
    npx ts-node src/scraper.ts
    ```
    *Note: The script is configured with `headless: false`, so you will see the browser window perform the actions.*

### Phase 3: CRM Synchronization (hubspotSync.ts)

This script reads the data from the `BabyNames` table and pushes it as new **Contacts** to your HubSpot account via their API.

  * **File:** `src/hubspotSync.ts`
  * **Action:** Reads data from MySQL and sends API requests to HubSpot.
  * **Run:**
    ```bash
    npx ts-node src/hubspotSync.ts
    ```

-----


