// Helper wrapper to interact with Catalyst Datastore
const getDatastore = (req) => {
    return req.catalystApp.datastore();
};

const executeZCQL = async (req, query) => {
    const zcql = req.catalystApp.zcql();
    return await zcql.executeZCQLQuery(query);
};

module.exports = {
    getDatastore,
    executeZCQL
};
