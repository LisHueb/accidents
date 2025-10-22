class SpiralChart {
    constructor() {
        this.margin = { top: 10, right: 40, bottom: 40, left: 40 };
        this.data = [];
        const maxAccidents = d3.max(this.data, d => d.accidents) || 1;
        this.colorScale = d3.scaleLinear()
            .domain([0, maxAccidents])
            .range(['#8f2020ff', '#ecdb59ff']);
        this.init();
        this.loadData();
    }
    
    init() {
        this.container = d3.select('#spiral');
        this.tooltip = d3.select('#tooltip');
        this.resize();
        
        // Event Listener für Größenänderungen
        window.addEventListener('resize', () => {
            setTimeout(() => this.resize(), 100);
        });
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resize(), 300);
        });
    }
    
    resize() {
        const containerElement = d3.select('.spiral-container').node();
        const containerRect = containerElement.getBoundingClientRect();
        const isMobile = window.innerWidth <= 768;
        
        let size;
        
        if (isMobile) {
            // Mobile: Nutze die verfügbare Container-Größe optimal
            // vmin sorgt dafür, dass es immer quadratisch bleibt und reinpasst
            const availableWidth = containerRect.width - 10;
            const availableHeight = containerRect.height - 10;
            size = Math.min(availableWidth, availableHeight);
            
            // ViewBox-Ansatz: Größere ViewBox für die Beschriftungen
            this.container
                .attr('viewBox', `-100 -100 1000 1000`) // Vergrößert von 800 auf 1000
                .attr('preserveAspectRatio', 'xMidYMid meet')
                .style('width', size + 'px')
                .style('height', size + 'px');
                
            // Interne Berechnungsgrößen basieren auf ViewBox
            this.width = 800;
            this.height = 800;
            this.radius = (Math.min(this.width, this.height) - Math.max(this.margin.top + this.margin.bottom, this.margin.left + this.margin.right)) / 2;
            
        } else {
            // Desktop: Normale responsive Berechnung
            const containerWidth = containerRect.width;
            size = Math.min(containerWidth - 40, 800);

            this.width = size;
            this.height = size;
            this.radius = (Math.min(this.width, this.height) - Math.max(this.margin.top + this.margin.bottom, this.margin.left + this.margin.right)) / 2;

            // Größere ViewBox auch für Desktop
            const viewBoxSize = size;
            const padding = 100; // zusätzlicher Rand
            this.container
                .attr('viewBox', `${-padding} ${-padding} ${viewBoxSize + 2*padding} ${viewBoxSize + 2*padding}`)
                .attr('preserveAspectRatio', 'xMidYMid meet')
                .style('width', '100%')
                .style('height', 'auto');
        }

        if (this.data.length > 0) {
            this.render();
        }
    }
    
    async loadData() {
        try {
            const csvText = await d3.text('Verkehrsunfallkalender_Daten_2024.csv');
            const lines = csvText.split('\n');
            const headers = lines[0].split(';');
            
            const csvData = lines.slice(1).map((line) => {
                if (!line.trim()) return null;
                const values = line.split(';');
                const row = {};
                headers.forEach((header, i) => {
                    row[header.trim()] = values[i] ? values[i].trim() : '';
                });
                return row;
            }).filter(d => d !== null);
            
            this.processData(csvData);
            this.render();
        } catch (error) {
            console.error('Fehler beim Laden der CSV-Datei:', error);
            console.log('Fallback zu Beispieldaten');
            const sampleData = this.generateSampleData();
            this.processData(sampleData);
            this.render();
        }
    }
    
    generateSampleData() {
        const data = [];
        const startDate = new Date(2021, 0, 1);
        const endDate = new Date(2024, 11, 31);
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            let accidents = 0;
            const month = d.getMonth();
            const seasonalFactor = Math.sin((month - 2) * Math.PI / 6) * 0.5 + 0.7;
            const dayOfWeek = d.getDay();
            const weekendFactor = (dayOfWeek === 5 || dayOfWeek === 6) ? 1.3 : 1.0;
            const randomFactor = Math.random();
            accidents = Math.round(seasonalFactor * weekendFactor * randomFactor * 25);
            
            data.push({
                Datum: d.toISOString().substr(0, 10),
                Verunglueckte_auf_EScooter: accidents
            });
        }
        return data;
    }
    
    processData(rawData) {
        this.data = rawData.map((d) => {
            let date;
            let dateStr = d.Datum || d.datum || '';
            
            if (!dateStr) return null;
            
            if (dateStr.includes('-')) {
                const parts = dateStr.split('-');
                if (parts[0].length === 4) {
                    date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                } else {
                    date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                }
            } else if (dateStr.includes('.')) {
                const parts = dateStr.split('.');
                date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            } else {
                return null;
            }
            
            let accidents = 0;
            const possibleColumns = [
                'Verunglueckte_auf_EScooter',
                'Verunglückte_auf_EScooter', 
                'Verunglueckte auf EScooter',
                'EScooter',
                'E-Scooter',
                'escooter',
                'e-scooter'
            ];
            
            for (let col of possibleColumns) {
                if (d[col] !== undefined && d[col] !== '' && d[col] !== null) {
                    accidents = parseInt(d[col]) || 0;
                    break;
                }
            }
            
            if (isNaN(date.getTime())) return null;
            
            return {
                date: date,
                accidents: accidents,
                year: date.getFullYear(),
                dayOfYear: this.getDayOfYear(date),
                daysSinceStart: this.getDaysSinceStart(date)
            };
        }).filter(d => d !== null && d.year >= 2021 && d.year <= 2024);
        
        this.data.sort((a, b) => a.date - b.date);
        
        const maxAccidents = d3.max(this.data, d => d.accidents);
        this.colorScale.domain([maxAccidents || 1, 0]);
        
        this.createLegend();
    }
    
    getDaysSinceStart(date) {
        const startDate = new Date(2021, 0, 1);
        const diff = date - startDate;
        const oneDay = 1000 * 60 * 60 * 24;
        return Math.floor(diff / oneDay);
    }
    
    getDayOfYear(date) {
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = date - start;
        const oneDay = 1000 * 60 * 60 * 24;
        return Math.floor(diff / oneDay);
    }
        
    createLegend() {
        const maxValue = this.colorScale.domain()[0];
        const minValue = Math.max(1, this.colorScale.domain()[1]);
        const isMobile = window.innerWidth <= 768;

        const legendContainer = d3.select('#legend-container')
            .html('')
            .style('text-align', 'center');

        const containerWidth = legendContainer.node().getBoundingClientRect().width;
        const svgWidth = Math.min(containerWidth - 20, 500);
        const rectWidth = Math.min(svgWidth - 40, 400);

        const legendSvg = legendContainer
            .append('svg')
            .attr('width', svgWidth)
            .attr('height', isMobile ? 50 : 50);

        const defs = legendSvg.append('defs');
        const gradient = defs.append('linearGradient')
            .attr('id', 'horizontal-legend-gradient')
            .attr('x1', '0%').attr('y1', '0%')
            .attr('x2', '100%').attr('y2', '0%');

        const steps = 20;
        for (let i = 0; i <= steps; i++) {
            const value = minValue + (i / steps) * (maxValue - minValue);
            gradient.append('stop')
                .attr('offset', `${(i / steps) * 100}%`)
                .attr('stop-color', this.colorScale(value));
        }

        const rectHeight = 15;
        const rectX = (svgWidth - rectWidth) / 2;

        legendSvg.append('rect')
            .attr('x', rectX)
            .attr('y', 10)
            .attr('width', rectWidth)
            .attr('height', rectHeight)
            .style('fill', 'url(#horizontal-legend-gradient)')
            .style('stroke', '#ccc')
            .attr('stroke-width', 1);

        const middleValue = (minValue + maxValue) / 2;
        const labelY = 35;
        const fontSize = isMobile ? '11px' : '12px';

        legendSvg.append('text')
            .attr('x', rectX)
            .attr('y', labelY)
            .attr('text-anchor', 'start')
            .attr('font-size', fontSize)
            .attr('font-weight', 'normal')
            .attr('fill', '#333')
            .text(`${Math.round(minValue)}`);

        legendSvg.append('text')
            .attr('x', rectX + rectWidth / 2)
            .attr('y', labelY)
            .attr('text-anchor', 'middle')
            .attr('font-size', fontSize)
            .attr('font-weight', 'normal')
            .attr('fill', '#333')
            .text(`${Math.round(middleValue)}`);

        legendSvg.append('text')
            .attr('x', rectX + rectWidth)
            .attr('y', labelY)
            .attr('text-anchor', 'end')
            .attr('font-size', fontSize)
            .attr('font-weight', 'normal')
            .attr('fill', '#333')
            .text(`${Math.round(maxValue)}`);
    }
    
    render() {
    this.container.selectAll('*').remove();
    
    const g = this.container
        .append('g')
        .attr('transform', `translate(${this.width / 2}, ${this.height / 2})`);
    
    const totalDays = this.data.length;
    const totalRotations = 4;
    const startRadius = 60;
    const endRadius = Math.min(this.width, this.height) / 2 - 80;
    
    // Jahre bestimmen
    const years = [...new Set(this.data.map(d => d.year))].sort();
    const yearGap = 13;
    const radiusReduction = Math.abs(yearGap) * (years.length - 1);
    const adjustedEndRadius = yearGap < 0 ? endRadius - radiusReduction : endRadius + Math.abs(yearGap) * (years.length - 1);
    const radiusIncrease = (adjustedEndRadius - startRadius) / totalDays;
    
    const maxAccidents = d3.max(this.data, d => d.accidents) || 1;
    const heightScale = d3.scaleLinear()
        .domain([0, maxAccidents])
        .range([0, 60]);
    
    const isMobile = window.innerWidth <= 768;
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const defs = g.append('defs');

    // Hintergrund-Fläche zeichnen
    this.createBackgroundArea(g, totalDays, totalRotations, startRadius, radiusIncrease, heightScale(maxAccidents), years, yearGap, adjustedEndRadius);

    // tatsächlicher äußerer Radius
    const actualEndRadius = adjustedEndRadius + heightScale(maxAccidents);

    // Monatslinien + Labels
    months.forEach((month, i) => {
        const dayOffset = -0.5 / totalDays * totalRotations * 2 * Math.PI;
        const angle = -Math.PI / 2 + (i / 12) * 2 * Math.PI + dayOffset;
        
        const x1 = Math.cos(angle) * (startRadius - 30);
        const y1 = Math.sin(angle) * (startRadius - 30);
        const x2 = Math.cos(angle) * (actualEndRadius + 32);
        const y2 = Math.sin(angle) * (actualEndRadius + 32);

        const gradId = `month-gradient-${i}`;
        const gradient = defs.append('linearGradient')
            .attr('id', gradId)
            .attr('gradientUnits', 'userSpaceOnUse')
            .attr('x1', x1).attr('y1', y1)
            .attr('x2', x2).attr('y2', y2);

        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#bbb')
            .attr('stop-opacity', 0.05);
        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#666')
            .attr('stop-opacity', 0.7);

        g.append('line')
            .attr('x1', x1)
            .attr('y1', y1)
            .attr('x2', x2)
            .attr('y2', y2)
            .attr('stroke', `url(#${gradId})`)
            .attr('stroke-width', 0.8);

        const labelRadius = actualEndRadius + 45;
        g.append('text')
            .attr('x', Math.cos(angle) * labelRadius)
            .attr('y', Math.sin(angle) * labelRadius + 4)
            .attr('text-anchor', 'middle')
            .attr('font-size', isMobile ? '10px' : '12px')
            .attr('font-weight', 'bold')
            .attr('fill', '#999')
            .text(month);
    });

    // Jahreslabels direkt am Anfang unterhalb der Balken (feinjustiert)
    const oneDayAngle = totalRotations * 2 * Math.PI / totalDays;
    const angleOffsetDays = 3.2; // wie viele "Tage" wir die Beschriftung nach rechts schieben (feinjustierbar)

    years.forEach((year) => {
        // Versuche gezielt den 1. Januar zu finden, fallback: erster Tag des Jahres in den Daten
        let firstIndex = this.data.findIndex(d => d.year === year && d.dayOfYear === 1);
        if (firstIndex === -1) firstIndex = this.data.findIndex(d => d.year === year);
        if (firstIndex === -1) return;
        const firstDay = this.data[firstIndex];

        // Winkel (auf Basis des Index im gesamten Datensatz) + kleiner rechter Offset
        let angle = -Math.PI / 2 + (firstIndex / totalDays) * totalRotations * 2 * Math.PI;
        angle += oneDayAngle * angleOffsetDays; // verschiebt ein bisschen nach rechts -> "mit dem 1.1. beginnen"

        // Radius des Startpunkts der Balken
        const radius = startRadius + firstIndex * radiusIncrease;

        // Label knapp unterhalb des Balkenanfangs platzieren (nach innen)
        const labelRadius = radius - 7; // <--- hier kannst du die Zahl vergrößern/verkleinern

        const yearX = Math.cos(angle) * labelRadius;
        const yearY = Math.sin(angle) * labelRadius;

        g.append('text')
            .attr('x', yearX)
            .attr('y', yearY)
            .attr('dy', '4px') // kleine vertikale Feinanpassung
            .attr('text-anchor', 'middle')
            .attr('font-size', isMobile ? '11px' : '12px') // etwas dezenter als Monatslabels
            .attr('font-weight', '700')
            .attr('fill', '#666')
            .style('pointer-events', 'none')
            .text(year);
    });

    // Linien für jeden Tag
    const thicknessFactor = isMobile ? 2.0 : 4.1; 

    const maxStrokeWidth = (isMobile ? 2 : 1.5) * thicknessFactor;
    const minStrokeWidth = (isMobile ? 0.8 : 0.6) * thicknessFactor;
    const maxHoverStrokeWidth = (isMobile ? 3.5 : 3) * thicknessFactor;
    const minHoverStrokeWidth = (isMobile ? 2 : 1.5) * thicknessFactor;
    const touchAreaWidth = isMobile ? 15 : 8;
        
    this.data.forEach((d, i) => {
        const dayProgress = i / totalDays;
        const angle = -Math.PI / 2 + dayProgress * totalRotations * 2 * Math.PI;
        
        const radius = startRadius + i * radiusIncrease;
        
        const baseX = Math.cos(angle) * radius;
        const baseY = Math.sin(angle) * radius;
        const lineHeight = heightScale(d.accidents);
        const endX = Math.cos(angle) * (radius + lineHeight);
        const endY = Math.sin(angle) * (radius + lineHeight);

        const radiusProgress = (radius - startRadius) / (endRadius - startRadius);
        const currentStrokeWidth = minStrokeWidth + (maxStrokeWidth - minStrokeWidth) * radiusProgress;
        const currentHoverStrokeWidth = minHoverStrokeWidth + (maxHoverStrokeWidth - minHoverStrokeWidth) * radiusProgress;

        const lineGroup = g.append('g').style('cursor', 'pointer');

        const mainLine = lineGroup.append('line')
            .attr('x1', baseX)
            .attr('y1', baseY)
            .attr('x2', endX)
            .attr('y2', endY)
            .attr('stroke', this.colorScale(d.accidents))
            .attr('stroke-width', currentStrokeWidth)
            .attr('stroke-linecap', 'round')
            .attr('opacity', 0.85)
            .attr('data-base-width', currentStrokeWidth)
            .attr('data-hover-width', currentHoverStrokeWidth);

        lineGroup.append('line')
            .attr('x1', baseX)
            .attr('y1', baseY)
            .attr('x2', endX)
            .attr('y2', endY)
            .attr('stroke', 'transparent')
            .attr('stroke-width', touchAreaWidth)
            .on('mouseover touchstart', (event) => {
                const hoverWidth = parseFloat(mainLine.attr('data-hover-width'));
                mainLine
                    .attr('stroke-width', hoverWidth)
                    .attr('opacity', 1);

                this.tooltip
                    .style('opacity', 1)
                    .html(`
                        <strong>Datum:</strong> ${d.date.toLocaleDateString('de-DE')}<br/>
                        <strong>E-Scooter Unfälle:</strong> ${d.accidents}<br/>
                        <strong>Jahr:</strong> ${d.year}
                    `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout touchend', () => {
                const baseWidth = parseFloat(mainLine.attr('data-base-width'));
                mainLine
                    .attr('stroke-width', baseWidth)
                    .attr('opacity', 0.85);

                this.tooltip.style('opacity', 0);
            });
    });
}


    createBackgroundArea(g, totalDays, totalRotations, startRadius, radiusIncrease, maxLineHeight, years, yearGap, adjustedEndRadius) {
        // Erstelle Pfad für die äußere Spirale (maximale Höhe)
        const outerPath = d3.path();
        const innerPath = d3.path();
        
        // Berechne Punkte für äußere und innere Spirale
        const numPoints = Math.min(totalDays, 500); // Begrenze für Performance
        const pointInterval = Math.max(1, Math.floor(totalDays / numPoints));
        
        let firstOuter = true;
        let firstInner = true;
        
        for (let i = 0; i < totalDays; i += pointInterval) {
            const dayProgress = i / totalDays;
            const angle = -Math.PI / 2 + dayProgress * totalRotations * 2 * Math.PI;
            
            // Einfache Radiusberechnung ohne zusätzliche Jahresabstände
            const radius = startRadius + i * radiusIncrease;
            
            // Äußere Spirale (mit maximaler Höhe)
            const outerX = Math.cos(angle) * (radius + maxLineHeight);
            const outerY = Math.sin(angle) * (radius + maxLineHeight);
            
            // Innere Spirale (Basis-Radius)
            const innerX = Math.cos(angle) * radius;
            const innerY = Math.sin(angle) * radius;
            
            if (firstOuter) {
                outerPath.moveTo(outerX, outerY);
                firstOuter = false;
            } else {
                outerPath.lineTo(outerX, outerY);
            }
            
            if (firstInner) {
                innerPath.moveTo(innerX, innerY);
                firstInner = false;
            } else {
                innerPath.lineTo(innerX, innerY);
            }
        }
        
        // Erstelle geschlossenen Pfad für die Fläche
        const areaPath = d3.path();
        
        // Äußere Spirale (vorwärts)
        for (let i = 0; i < totalDays; i += pointInterval) {
            const dayProgress = i / totalDays;
            const angle = -Math.PI / 2 + dayProgress * totalRotations * 2 * Math.PI;
            
            const radius = startRadius + i * radiusIncrease;
            const outerX = Math.cos(angle) * (radius + maxLineHeight);
            const outerY = Math.sin(angle) * (radius + maxLineHeight);
            
            if (i === 0) {
                areaPath.moveTo(outerX, outerY);
            } else {
                areaPath.lineTo(outerX, outerY);
            }
        }
        
        // Innere Spirale (rückwärts)
        for (let i = totalDays - 1; i >= 0; i -= pointInterval) {
            const dayProgress = i / totalDays;
            const angle = -Math.PI / 2 + dayProgress * totalRotations * 2 * Math.PI;
            
            const radius = startRadius + i * radiusIncrease;
            const innerX = Math.cos(angle) * radius;
            const innerY = Math.sin(angle) * radius;
            
            areaPath.lineTo(innerX, innerY);
        }
        
        areaPath.closePath();
        
        // Zeichne die Hintergrund-Fläche
        g.append('path')
            .attr('d', areaPath.toString())
            .attr('fill', '#c6c6c6ff')
            .attr('opacity', 0.3)
            .attr('stroke', 'none');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    new SpiralChart();
});