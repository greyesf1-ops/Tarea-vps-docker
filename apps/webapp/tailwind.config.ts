import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        shell: "#f7f1e8",
        mist: "#eef5f4",
        sea: "#1b9aaa",
        slate: "#122033",
        cloud: "#f9fbfb",
        amber: "#df8c35",
        coral: "#c85d4a",
        moss: "#3e6b61"
      },
      boxShadow: {
        soft: "0 24px 80px rgba(18, 32, 51, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
