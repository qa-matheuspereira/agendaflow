/** @type {import('prettier').Config} */
module.exports = {
  ...require('@agendaflow/config/prettier'),
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindConfig: './tailwind.config.ts',
};
