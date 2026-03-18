/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#F2EDE4",
        "card-green": "#466543",
        "card-light": "#FAF8F5",
        "text-main": "#222222",
        "text-muted": "#757575",
        accent: "#648754",
        "icon-peach": "#EEDCCB",
        "icon-green": "#E1EAD8",
        "icon-coral": "#EFCFC3",
        "icon-blue": "#DCE9E9",
      }
    },
  },
  plugins: [],
}
