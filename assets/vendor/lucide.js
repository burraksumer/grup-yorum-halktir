const plugin = require("tailwindcss/plugin")
const fs = require("fs")
const path = require("path")

module.exports = plugin(function({matchComponents, theme, addComponents}) {
  // Lucide icons directory - SVG files should be placed here
  let iconsDir = path.join(__dirname, "./lucide-icons")
  
  if (!fs.existsSync(iconsDir)) {
    // Return empty plugin if directory doesn't exist yet
    matchComponents({
      "lucide": () => ({})
    }, {values: {}})
    return
  }
  
  let values = {}
  
  // Read all SVG files from the directory
  try {
    fs.readdirSync(iconsDir).forEach(file => {
      if (file.endsWith(".svg")) {
        let name = path.basename(file, ".svg")
        values[name] = {name, fullPath: path.join(iconsDir, file)}
      }
    })
  } catch (e) {
    console.error("Error reading Lucide icons:", e)
  }
  
  // Generate component classes for each icon
  const iconComponents = {}
  Object.keys(values).forEach(iconName => {
    const fullPath = values[iconName].fullPath
    let content = fs.readFileSync(fullPath).toString().replace(/\r?\n|\r/g, "")
    content = encodeURIComponent(content)
    
    iconComponents[`.lucide-${iconName}`] = {
      [`--lucide-${iconName}`]: `url('data:image/svg+xml;utf8,${content}')`,
      "-webkit-mask": `var(--lucide-${iconName})`,
      "mask": `var(--lucide-${iconName})`,
      "mask-repeat": "no-repeat",
      "background-color": "currentColor",
      "vertical-align": "middle",
      "display": "inline-block",
      "width": theme("spacing.6"),
      "height": theme("spacing.6")
    }
  })
  
  // Add all icon components at once
  addComponents(iconComponents)
  
  // Also support matchComponents for utility classes
  matchComponents({
    "lucide": ({name, fullPath}) => {
      let content = fs.readFileSync(fullPath).toString().replace(/\r?\n|\r/g, "")
      content = encodeURIComponent(content)
      let size = theme("spacing.6")
      
      return {
        [`--lucide-${name}`]: `url('data:image/svg+xml;utf8,${content}')`,
        "-webkit-mask": `var(--lucide-${name})`,
        "mask": `var(--lucide-${name})`,
        "mask-repeat": "no-repeat",
        "background-color": "currentColor",
        "vertical-align": "middle",
        "display": "inline-block",
        "width": size,
        "height": size
      }
    }
  }, {values})
})

