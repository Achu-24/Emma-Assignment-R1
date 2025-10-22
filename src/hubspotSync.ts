import { Sequelize, DataTypes } from 'sequelize';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

interface DataItem {
    firstName: string;
    genderKey: string;
}

const introducePause = (durationMs: number) => {
    return new Promise(permit => setTimeout(permit, durationMs));
};


const databaseClient = new Sequelize('robot_db', 'root', process.env.MYSQL_PASSWORD, {
    host: '127.0.0.1',
    dialect: 'mysql',
    logging: (msg: string) => {},
});

const SourceRecordModel = databaseClient.define('SourceRecord', {
    firstName: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'name' 
    },
    genderKey: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'sex' 
    },
}, {
    tableName: 'BabyNames',
    timestamps: false,
});

async function pushRecordsToCRM() {

    const tokenStatus = !!process.env.HUBSPOT_API_TOKEN ? 'LOADED' : 'MISSING';
    console.log(`🔐 Authorization Token Status: ${tokenStatus}`);

    console.log('Fetching records from local data source...');
    const sourceDataList = await SourceRecordModel.findAll({ raw: true }) as unknown as DataItem[];
    console.log(`✅ ${sourceDataList.length} records retrieved.`);

    const BATCH_LIMIT = 500;
    const initialBatch = sourceDataList.slice(0, 500);
    console.log(`Processing a sample batch of ${initialBatch.length} records.`);

    for (let index = 0; index < initialBatch.length; index++) {
        const item = initialBatch[index];

        const crmPayload = {
            properties: {
                firstname: item.firstName,
                gender: item.genderKey
            }
        };

        try {
            await axios.post(
                'https://api.hubapi.com/crm/v3/objects/contacts',
                crmPayload, 
                {
                    headers: {
                        'Authorization': 'Bearer ' + process.env.HUBSPOT_API_TOKEN,
                        'Content-Type': 'application/json',
                    }
                }
            );
            console.log(`Contact for "${item.firstName}" successfully pushed 🎉.`);

        } catch (apiError: any) {
            const errorMessage = apiError.response?.data?.message || apiError.message;
            console.error(`🛑 FAILED to create contact for "${item.firstName}". Reason: ${errorMessage}`);
        }

        await introducePause(200);
    }

    console.log('All records have been processed and synced!! Exiting.');
}

pushRecordsToCRM().catch(executionError => {
    console.error('Error in main sync process:', executionError);
});