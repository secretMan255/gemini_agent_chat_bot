module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'import', 'unused-imports'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:import/recommended',
        'plugin:import/typescript',
        'prettier'
    ],
    rules: {
        'unused-imports/no-unused-imports': 'warn',
        'import/order': ['warn', { 'newlines-between': 'always' }]
    }
};
