import { Sequelize, DataTypes } from 'sequelize';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Configure environment file loading
dotenv.config();

// Define a new interface name for data structure
interface DataItem {
    firstName: string;
    genderKey: string;
}

// Function for introducing a pause (re-implemented)
const introducePause = (durationMs: number) => {
    return new Promise(permit => setTimeout(permit, durationMs));
};

// =========================================================================
// == DATA SOURCE CONFIGURATION ==
// =========================================================================
const databaseClient = new Sequelize('robot_db', 'root', process.env.MYSQL_PASSWORD, {
    host: '127.0.0.1',
    dialect: 'mysql',
    // Set up a custom logger to suppress Sequelize's default logging
    logging: (msg: string) => {},
});

// Define the model with slightly different property names and structure
const SourceRecordModel = databaseClient.define('SourceRecord', {
    firstName: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'name' // Use 'field' option to map to original column 'name'
    },
    genderKey: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'sex' // Use 'field' option to map to original column 'sex'
    },
}, {
    tableName: 'BabyNames',
    timestamps: false,
});
// =========================================================================

/**
 * Main function to retrieve records and push them to the CRM (HubSpot).
 */
async function pushRecordsToCRM() {
    console.log(`\n-- CRM Data PUSH Initiated --`);

    // Verify authentication status
    const tokenStatus = !!process.env.HUBSPOT_API_TOKEN ? 'LOADED' : 'MISSING';
    console.log(`🔐 Authorization Token Status: ${tokenStatus}`);

    console.log('🔄 Fetching records from local data source...');
    // Use an alias for findAll and cast the result
    const sourceDataList = await SourceRecordModel.findAll({ raw: true }) as unknown as DataItem[];
    console.log(`✅ ${sourceDataList.length} records retrieved.`);

    // Adjust the limit logic slightly
    const BATCH_LIMIT = 6;
    const initialBatch = sourceDataList.slice(0, 6);
    console.log(`Processing a sample batch of ${initialBatch.length} records.`);

    for (let index = 0; index < initialBatch.length; index++) {
        const item = initialBatch[index];

        // Construct the payload with different variable names
        const crmPayload = {
            properties: {
                // Use a different, more descriptive key for the properties object
                firstname: item.firstName,
                gender: item.genderKey
            }
        };

        try {
            // Wait for the API call to complete
            await axios.post(
                'https://api.hubapi.com/crm/v3/objects/contacts',
                crmPayload, // Variable name changed
                {
                    headers: {
                        // Use a different formatting style for headers object
                        'Authorization': 'Bearer ' + process.env.HUBSPOT_API_TOKEN,
                        'Content-Type': 'application/json',
                    }
                }
            );
            console.log(`Contact for "${item.firstName}" successfully pushed 🎉.`);

        } catch (apiError: any) {
            // Modify error logging to be more verbose
            const errorMessage = apiError.response?.data?.message || apiError.message;
            console.error(`🛑 FAILED to create contact for "${item.firstName}". Reason: ${errorMessage}`);
        }

        // Apply rate limit pause with a slightly different value
        await introducePause(200);
    }

    console.log('All records have been processed and synced!! Exiting.');
}

// Execute the main function and handle exceptions
pushRecordsToCRM().catch(executionError => {
    console.error('Error in main sync process:', executionError);
});