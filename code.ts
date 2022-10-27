// This plugin resizes frames or component to a fixed offset from their contents.

// The 'input' event listens for text change in the Quick Actions box after a plugin is 'Tabbed' into.
figma.parameters.on("input", ({ query, result }: ParameterInputEvent) => {
    const defaults = ["8", "16", "24", "48", "64"]
    const selection = getFilteredSelection()

    if (selection.length === 0) {
        result.setError("⚠️ Select at least one frame or component first")
        return
    }

    // Check the input is valid
    const number = Number(query)
    if (!Number.isInteger(number) || number < 0) {
        result.setError("⚠️ Try entering a positive number")
        return
    }

    const suggestions = (
        query === "" || defaults.includes(query)
            ? defaults
            : [query, ...defaults]
    ) // default values plus the typed value
        .filter((s) => s.includes(query)) // just values matching the typed value
        .map((value) => ({ name: value, data: Number(value) })) // include the numerical value with the suggestions

    result.setSuggestions(suggestions)
})

// When the user presses Enter after inputting all parameters, the 'run' event is fired.
figma.on("run", ({ parameters }: RunEvent) => {
    const closeMessage = startPluginWithParameters(parameters)
    figma.closePlugin(closeMessage)
})

function startPluginWithParameters(parameters: ParameterValues): string {
    const selection = getFilteredSelection()

    if (selection.length === 0) {
        figma.notify("⚠️ Select at least one frame or component first", {
            error: true,
        })
        return ""
    }

    const offset = Number(parameters["offset"])
    const offsetHor = Number(parameters["offsetHor"])

    selection.forEach((item) => {
        resizeWithOffset(item, offset, offsetHor)
    })
    if (selection.length === 1) {
        return "1 layer resized"
    } else {
        return `${selection.length} layers resized`
    }
}

function getFilteredSelection() {
    return figma.currentPage.selection.filter(
        (node) =>
            (node.type === "FRAME" ||
                node.type === "COMPONENT" ||
                node.type === "COMPONENT_SET" ||
                node.type === "SECTION") &&
            node.children.length > 0
    )
}

function resizeWithOffset(parent, offset, offsetHor) {
    // If offsetHor not given
    if (isNaN(offsetHor)) offsetHor = offset

    const children = parent.children
    if (children.length === 0) return

    if (parent.layoutMode === "NONE" || parent.layoutMode === undefined) {
        let bounds = getBounds(children)

        // Move and resize parent
        parent.x = parent.x + bounds.x - offsetHor
        parent.y = parent.y + bounds.y - offset
        parent.resizeWithoutConstraints(
            bounds.width + offsetHor * 2,
            bounds.height + offset * 2
        )

        // Children move with parent, so they need to be moved back
        children.forEach((child) => {
            child.x = child.x - bounds.x + offsetHor
            child.y = child.y - bounds.y + offset
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

function getBounds(nodes: SceneNode[]) {
    const bounds = {
        x: 0,
        y: 0,
        x2: 0,
        y2: 0,
        width: 0,
        height: 0,
    }

    function applyMatrixToPoint(matrix: number[][], point: number[]) {
        return [
            point[0] * matrix[0][0] + point[1] * matrix[0][1] + matrix[0][2],
            point[0] * matrix[1][0] + point[1] * matrix[1][1] + matrix[1][2],
        ]
    }

    if (nodes.length) {
        const xy = nodes.reduce(
            (rez, node) => {
                // If object doesn't support relative Transform
                if (!node.relativeTransform) {
                    console.warn(
                        "Provided node haven't \"relativeTransform\" property, but it's required for calculations."
                    )
                    return rez
                }
                // If object has no height or width
                if (node.height === undefined || node.width === undefined) {
                    console.warn(
                        "Provided node haven't \"width/height\" property, but it's required for calculations."
                    )
                    return rez
                }

                // If object has no transform
                if (JSON.stringify(node.relativeTransform) === JSON.stringify([[1, 0, 0], [0, 1, 0],]))
                    return rez

                const halfHeight = node.height / 2
                const halfWidth = node.width / 2

                const [[c0, s0, x], [s1, c1, y]] = node.relativeTransform
                const matrix = [
                    [c0, s0, x + halfWidth * c0 + halfHeight * s0],
                    [s1, c1, y + halfWidth * s1 + halfHeight * c1],
                ]

                // the coordinates of the corners of the rectangle
                const XY = {
                    x: [1, -1, 1, -1],
                    y: [1, -1, -1, 1],
                }

                // fill in
                for (let i = 0; i <= 3; i++) {
                    const a = applyMatrixToPoint(matrix, [
                        XY.x[i] * halfWidth,
                        XY.y[i] * halfHeight,
                    ])
                    XY.x[i] = a[0]
                    XY.y[i] = a[1]
                }

                XY.x.sort((a, b) => a - b)
                XY.y.sort((a, b) => a - b)

                rez.x.push(XY.x[0])
                rez.y.push(XY.y[0])
                rez.x2.push(XY.x[3])
                rez.y2.push(XY.y[3])
                return rez
            },
            { x: [], y: [], x2: [], y2: [] }
        )

        bounds.x = Math.min(...xy.x)
        bounds.y = Math.min(...xy.y)
        bounds.x2 = Math.max(...xy.x2)
        bounds.y2 = Math.max(...xy.y2)
        bounds.width = bounds.x2 - bounds.x
        bounds.height = bounds.y2 - bounds.y
    }

    return bounds
}
