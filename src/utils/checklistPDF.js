import jsPDF from 'jspdf'

/**
 * Generate PDF from checklist
 */
export async function generateChecklistPDF(
    items,
    userProfile,
    riskScores,
    completion
) {
    try {
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        })

        const margin = 20
        const pageWidth = pdf.internal.pageSize.getWidth()
        const contentWidth = pageWidth - margin * 2
        let yPosition = margin

        // Helper function for adding text with word wrap and updating Y position
        const addText = (text, size, isBold, color, marginBottom = 5) => {
            pdf.setFontSize(size)
            pdf.setFont('helvetica', isBold ? 'bold' : 'normal')
            if (color) pdf.setTextColor(color[0], color[1], color[2])
            
            const lines = pdf.splitTextToSize(text, contentWidth)
            
            // Check if we need a new page
            if (yPosition + (lines.length * size * 0.4) > pdf.internal.pageSize.getHeight() - margin) {
                pdf.addPage()
                yPosition = margin
            }
            
            pdf.text(lines, margin, yPosition)
            yPosition += (lines.length * size * 0.4) + marginBottom
        }

        // HEADER
        addText('HANDA KA BA?', 24, true, [0, 56, 168], 2)
        addText('Disaster Preparedness Checklist', 12, false, [100, 100, 100], 10)

        // HOUSEHOLD INFO
        addText('Household Information', 14, true, [0, 0, 0], 4)
        addText(`Location: ${userProfile.barangay}, ${userProfile.city}`, 10, false, [50, 50, 50], 2)
        addText(`Housing Type: ${userProfile.housing_type}`, 10, false, [50, 50, 50], 2)
        addText(`Household Size: ${userProfile.household_size} people`, 10, false, [50, 50, 50], 2)
        addText(`Generated: ${new Date().toLocaleDateString()}`, 10, false, [50, 50, 50], 10)

        // RISK SUMMARY
        addText('Risk Profile', 14, true, [0, 0, 0], 4)
        const risks = [
            `Flood: ${riskScores.flood_risk}`,
            `Earthquake: ${riskScores.earthquake_risk}`,
            `Typhoon: ${riskScores.typhoon_risk}`,
            `Landslide: ${riskScores.landslide_risk}`,
            `Heat: ${riskScores.heat_risk}`
        ].join('  |  ')
        addText(risks, 10, false, [50, 50, 50], 2)
        addText(`Overall Score: ${riskScores.overall_score}/100`, 10, true, [0, 56, 168], 10)

        // PROGRESS
        const percentage = Math.round((completion.completed / completion.total) * 100)
        addText(`Progress: ${completion.completed}/${completion.total} items completed (${percentage}%)`, 12, true, [0, 150, 0], 15)

        // ITEMS
        addText('Action Items', 16, true, [0, 0, 0], 8)

        items.forEach(item => {
            // Urgency color
            let urgencyColor = [100, 100, 100]
            if (item.urgency === 'CRITICAL') urgencyColor = [200, 0, 0]
            if (item.urgency === 'HIGH') urgencyColor = [200, 100, 0]
            if (item.urgency === 'MEDIUM') urgencyColor = [150, 150, 0]

            const checkbox = item.completed ? '[ x ]' : '[   ]'
            
            // Header for item
            addText(`${checkbox} ${item.rank}. ${item.category} - ${item.urgency}`, 11, true, urgencyColor, 2)
            
            // Task
            addText(`Task: ${item.task}`, 10, false, [0, 0, 0], 1)
            
            // Reason
            addText(`Why: ${item.reason}`, 9, false, [100, 100, 100], 1)
            
            // Cost
            addText(`Est. Cost: ₱${item.estimated_cost}`, 9, false, [100, 100, 100], 6)
        })

        const filename = `checklist-${new Date().toISOString().split('T')[0]}.pdf`
        pdf.save(filename)

        return { success: true, filename }

    } catch (error) {
        console.error('PDF generation error:', error)
        throw error
    }
}