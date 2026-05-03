const colorToken = (token) => `oklch(var(${token}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Josefin Sans", "system-ui", "sans-serif"],
      },
      colors: {
        border: colorToken("--border"),
        input: colorToken("--input"),
        ring: colorToken("--ring"),
        background: colorToken("--background"),
        foreground: colorToken("--foreground"),
        sidebar: {
          DEFAULT: colorToken("--sidebar"),
          foreground: colorToken("--sidebar-foreground"),
          primary: colorToken("--sidebar-primary"),
          "primary-foreground": colorToken("--sidebar-primary-foreground"),
          accent: colorToken("--sidebar-accent"),
          "accent-foreground": colorToken("--sidebar-accent-foreground"),
          border: colorToken("--sidebar-border"),
          ring: colorToken("--sidebar-ring"),
        },
        chart: {
          "1": colorToken("--chart-1"),
          "2": colorToken("--chart-2"),
          "3": colorToken("--chart-3"),
          "4": colorToken("--chart-4"),
          "5": colorToken("--chart-5"),
        },
        primary: {
          DEFAULT: colorToken("--primary"),
          foreground: colorToken("--primary-foreground"),
        },
        secondary: {
          DEFAULT: colorToken("--secondary"),
          foreground: colorToken("--secondary-foreground"),
        },
        muted: {
          DEFAULT: colorToken("--muted"),
          foreground: colorToken("--muted-foreground"),
        },
        accent: {
          DEFAULT: colorToken("--accent"),
          foreground: colorToken("--accent-foreground"),
        },
        destructive: {
          DEFAULT: colorToken("--destructive"),
          foreground: colorToken("--destructive-foreground"),
        },
        popover: {
          DEFAULT: colorToken("--popover"),
          foreground: colorToken("--popover-foreground"),
        },
        card: {
          DEFAULT: colorToken("--card"),
          foreground: colorToken("--card-foreground"),
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
