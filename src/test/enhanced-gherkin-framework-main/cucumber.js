module.exports = {
    default: {
        require: [
            'cucumber/features/step_definitions/*.js',
            'cucumber/features/support/*.js'
        ],
        timeout: 30000,
        format: [
            'progress',
            'json:reports/report.json'
        ]
    }
};
