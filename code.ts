

// This plugin resizes frames or component to a fixed offset from their contents.

// The 'input' event listens for text change in the Quick Actions box after a plugin is 'Tabbed' into.
figma.parameters.on("input", ({ query, result }: ParameterInputEvent) => {
    const defaultSizes = ["8", "16", "24", "48", "64"]

    const selection = getFilteredSelection()

    if (selection.length === 0) {
        result.setError("⚠️ Select at least one frame or component first")
        return
    }

    // Check the input is valid
    const integer = parseInt(query)
    if (query !== "" && (isNaN(integer) || integer < 0)) {
        result.setError("⚠️ Try entering a positive number")
        return
    }

    const suggestions =
        query === "" || defaultSizes.includes(query)
            ? defaultSizes
            : [query, ...defaultSizes]

    result.setSuggestions(suggestions.filter((s) => s.includes(query)))
})

// When the user presses Enter after inputting all parameters, the 'run' event is fired.
figma.on("run", ({ parameters }: RunEvent) => {
    if (parameters) {
        startPluginWithParameters(parameters)
    }
})

function startPluginWithParameters(parameters: ParameterValues) {
    const selection = getFilteredSelection()
    if (selection.length === 0) {
        figma.notify("⚠️ Select at least one frame or component first")
        figma.closePlugin()
        return
    }

    const offset = parseInt(parameters["offset"])
    const offsetHor = parseInt(parameters["offsetHor"])

    selection.forEach((item) => {
        resizeWithOffset(item, offset, offsetHor)
    })
    if (selection.length === 1) {
        figma.notify("1 layer resized")
    } else {
        figma.notify(`${selection.length} layers resized`)
    }

    // Make sure to close the plugin when you're done. Otherwise the plugin will
    // keep running, which shows the cancel button at the bottom of the screen.
    figma.closePlugin()
}

function getFilteredSelection() {
    return figma.currentPage.selection.filter(
        (node) =>
            (node.type === "FRAME" ||
                node.type === "COMPONENT" ||
                node.type === "COMPONENT_SET") &&
            node.children.length > 0
    )
}

function resizeWithOffset(parent, offset, offsetHor) {
    // If offsetHor not given
    if (isNaN(offsetHor)) offsetHor = offset

    const children = parent.children
    if (children.length === 0) return

    if (parent.layoutMode === "NONE") {
        // Calculate bounding box
        const topLeftX = Math.min(...children.map((child) => child.x))
        const topLeftY = Math.min(...children.map((child) => child.y))
        const bottomRigthX = Math.max(
            ...children.map((child) => child.x + child.width)
        )
        const bottomRigthY = Math.max(
            ...children.map((child) => child.y + child.height)
        )
        const width = bottomRigthX - topLeftX
        const height = bottomRigthY - topLeftY

        // Move and resize parent
        parent.x = parent.x + topLeftX - offsetHor
        parent.y = parent.y + topLeftY - offset
        parent.resizeWithoutConstraints(width + offsetHor * 2, height + offset * 2)

        // Children move with parent, so they need to be moved back
        children.forEach((child) => {
            child.x = child.x - topLeftX + offsetHor
            child.y = child.y - topLeftY + offset
        })
    } else {
        // If we have auto-layout
        parent.x = parent.x + parent.paddingLeft - offsetHor
        parent.y = parent.y + parent.paddingTop - offset
        parent.paddingLeft = offsetHor
        parent.paddingRight = offsetHor
        parent.paddingTop = offset
        parent.paddingBottom = offset
    }
}
