class SpiralChart {
    constructor() {
        this.margin = { top: 10, right: 40, bottom: 40, left: 40 };
        this.data = [];
        this.colorScale = d3.scaleLinear().range(['#762121ff', '#62b9d3ff']);
        this.init();
        this.loadData();
    }
    
    init() {
        this.container = d3.select('#spiral');
        this.tooltip = d3.select('#tooltip');
        this.resize();
        
        window.addEventListener('resize', () => setTimeout(() => this.resize(), 100));
        window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 300));
    }
    
    resize() {
        const containerRect = d3.select('.spiral-container').node().getBoundingClientRect();
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            const size = Math.min(containerRect.width - 10, containerRect.height - 10);
            this.container
                .attr('viewBox', '-100 -100 1000 1000')
                .attr('preserveAspectRatio', 'xMidYMid meet')
                .style('width', size + 'px')
                .style('height', size + 'px');
            this.width = this.height = 800;
        } else {
            const size = Math.min(containerRect.width - 40, 800);
            this.width = this.height = size;
            const padding = 100;
            this.container
                .attr('viewBox', `${-padding} ${-padding} ${size + 2*padding} ${size + 2*padding}`)
                .attr('preserveAspectRatio', 'xMidYMid meet')
                .style('width', '100%')
                .style('height', 'auto');
        }
        
        this.radius = (Math.min(this.width, this.height) - Math.max(this.margin.top + this.margin.bottom, this.margin.left + this.margin.right)) / 2;
        
        if (this.data.length > 0) this.render();
    }
    
    async loadData() {
        try {
            const csvText = await d3.text('Verkehrsunfallkalender_Daten_2024.csv');
            const lines = csvText.split('\n');
            const headers = lines[0].split(';');
            
            const csvData = lines.slice(1).map(line => {
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
        }
    }
    
    processData(rawData) {
        this.data = rawData.map(d => {
            const dateStr = d.Datum || d.datum || '';
            if (!dateStr) return null;
            
            let date;
            if (dateStr.includes('-')) {
                const parts = dateStr.split('-');
                date = parts[0].length === 4 
                    ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
                    : new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            } else if (dateStr.includes('.')) {
                const parts = dateStr.split('.');
                date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            } else return null;
            
            const possibleColumns = ['Verunglueckte_auf_EScooter', 'Verunglückte_auf_EScooter', 
                'Verunglueckte auf EScooter', 'EScooter', 'E-Scooter', 'escooter', 'e-scooter'];
            let accidents = 0;
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
        
        const maxAccidents = d3.max(this.data, d => d.accidents) || 1;
        this.colorScale.domain([maxAccidents, 0]);
    }
    
    getDaysSinceStart(date) {
        return Math.floor((date - new Date(2021, 0, 1)) / (1000 * 60 * 60 * 24));
    }
    
    getDayOfYear(date) {
        return Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    }
    
    createLegend() {
        const [maxValue, minValue] = [this.colorScale.domain()[0], Math.max(1, this.colorScale.domain()[1])];
        const isMobile = window.innerWidth <= 768;
        
        const legendContainer = d3.select('#legend-container').html('').style('text-align', 'center');
        const containerWidth = legendContainer.node().getBoundingClientRect().width;
        const svgWidth = Math.min(containerWidth - 20, 500);
        const rectWidth = Math.min(svgWidth - 40, 400);
        
        const legendSvg = legendContainer.append('svg')
            .attr('width', svgWidth)
            .attr('height', 50);
        
        const gradient = legendSvg.append('defs').append('linearGradient')
            .attr('id', 'horizontal-legend-gradient')
            .attr('x1', '0%').attr('y1', '0%')
            .attr('x2', '100%').attr('y2', '0%');
        
        for (let i = 0; i <= 20; i++) {
            const value = minValue + (i / 20) * (maxValue - minValue);
            gradient.append('stop')
                .attr('offset', `${(i / 20) * 100}%`)
                .attr('stop-color', this.colorScale(value));
        }
        
        const rectX = (svgWidth - rectWidth) / 2;
        legendSvg.append('rect')
            .attr('x', rectX)
            .attr('y', 10)
            .attr('width', rectWidth)
            .attr('height', 15)
            .style('fill', 'url(#horizontal-legend-gradient)')
            .style('stroke', '#ccc')
            .attr('stroke-width', 1);
        
        const fontSize = isMobile ? '11px' : '12px';
        const middleValue = (minValue + maxValue) / 2;
        
        [[rectX, minValue, 'start'], 
         [rectX + rectWidth / 2, middleValue, 'middle'], 
         [rectX + rectWidth, maxValue, 'end']].forEach(([x, val, anchor]) => {
            legendSvg.append('text')
                .attr('x', x)
                .attr('y', 35)
                .attr('text-anchor', anchor)
                .attr('font-size', fontSize)
                .attr('fill', '#333')
                .text(Math.round(val));
        });
    }
    
    render() {
        this.container.selectAll('*').remove();
        
        const g = this.container.append('g')
            .attr('transform', `translate(${this.width / 2}, ${this.height / 2})`);
        
        const totalDays = this.data.length;
        const totalRotations = 4;
        const startRadius = 60;
        const endRadius = Math.min(this.width, this.height) / 2 - 80;
        
        const years = [...new Set(this.data.map(d => d.year))].sort();
        const yearGap = 13;
        const adjustedEndRadius = endRadius + Math.abs(yearGap) * (years.length - 1);
        const radiusIncrease = (adjustedEndRadius - startRadius) / totalDays;
        
        const maxAccidents = d3.max(this.data, d => d.accidents) || 1;
        const heightScale = d3.scaleLinear().domain([0, maxAccidents]).range([0, 60]);
        
        const isMobile = window.innerWidth <= 760;
        const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        const defs = g.append('defs');
        
        this.createBackgroundArea(g, totalDays, totalRotations, startRadius, radiusIncrease, heightScale(maxAccidents));
        
        const actualEndRadius = adjustedEndRadius + heightScale(maxAccidents);
        
        // Monatslinien und Labels
        months.forEach((month, i) => {
            const angle = -Math.PI / 2 + (i / 12) * 2 * Math.PI - 0.5 / totalDays * totalRotations * 2 * Math.PI;
            
            const [x1, y1] = [Math.cos(angle) * (startRadius - 30), Math.sin(angle) * (startRadius - 30)];
            const [x2, y2] = [Math.cos(angle) * (actualEndRadius + 32), Math.sin(angle) * (actualEndRadius + 10)];
            
            const gradient = defs.append('linearGradient')
                .attr('id', `month-gradient-${i}`)
                .attr('gradientUnits', 'userSpaceOnUse')
                .attr('x1', x1).attr('y1', y1)
                .attr('x2', x2).attr('y2', y2);
            
            gradient.append('stop').attr('offset', '0%').attr('stop-color', '#130a27ff').attr('stop-opacity', 0.05);
            gradient.append('stop').attr('offset', '100%').attr('stop-color', '#130a27ff').attr('stop-opacity', 0.7);
            
            g.append('line')
                .attr('x1', x1).attr('y1', y1)
                .attr('x2', x2).attr('y2', y2)
                .attr('stroke', `url(#month-gradient-${i})`)
                .attr('stroke-width', 0.8);
            
            g.append('text')
                .attr('x', Math.cos(angle) * (actualEndRadius + 45))
                .attr('y', Math.sin(angle) * (actualEndRadius + 45) + 4)
                .attr('text-anchor', 'middle')
                .attr('font-size', isMobile ? '10px' : '12px')
                .attr('font-weight', 'bold')
                .attr('fill', '#150e29ff')
                .text(month);
        });
        
        // Jahreslabels
        const oneDayAngle = totalRotations * 2 * Math.PI / totalDays;
        years.forEach(year => {
            let firstIndex = this.data.findIndex(d => d.year === year && d.dayOfYear === 1);
            if (firstIndex === -1) firstIndex = this.data.findIndex(d => d.year === year);
            if (firstIndex === -1) return;
            
            const angle = -Math.PI / 2 + (firstIndex / totalDays) * totalRotations * 2 * Math.PI + oneDayAngle * 3.2;
            const radius = startRadius + firstIndex * radiusIncrease - 7;
            
            g.append('text')
                .attr('x', Math.cos(angle) * radius)
                .attr('y', Math.sin(angle) * radius)
                .attr('dy', '4px')
                .attr('text-anchor', 'middle')
                .attr('font-size', isMobile ? '11px' : '12px')
                .attr('font-weight', '700')
                .attr('fill', '#0e0c23ff')
                .style('pointer-events', 'none')
                .text(year);
        });
        
        // Balken für jeden Tag
        const thicknessFactor = isMobile ? 2.0 : 3.5;
        const [minStroke, maxStroke] = [(isMobile ? 0.4 : 0.2) * thicknessFactor, (isMobile ? 2.2 : 1.2) * thicknessFactor];
        const [minHover, maxHover] = [(isMobile ? 1.6 : 1) * thicknessFactor, (isMobile ? 3 : 2) * thicknessFactor];
        const touchAreaWidth = isMobile ? 15 : 8;
        
        this.data.forEach((d, i) => {
            const angle = -Math.PI / 2 + (i / totalDays) * totalRotations * 2 * Math.PI;
            const radius = startRadius + i * radiusIncrease;
            const lineHeight = heightScale(d.accidents);
            
            const [baseX, baseY] = [Math.cos(angle) * radius, Math.sin(angle) * radius];
            const [endX, endY] = [Math.cos(angle) * (radius + lineHeight), Math.sin(angle) * (radius + lineHeight)];
            
            const radiusProgress = (radius - startRadius) / (endRadius - startRadius);
            const currentStroke = minStroke + (maxStroke - minStroke) * radiusProgress;
            const currentHover = minHover + (maxHover - minHover) * radiusProgress;
            
            const lineGroup = g.append('g').style('cursor', 'pointer');
            
            const mainLine = lineGroup.append('line')
                .attr('x1', baseX).attr('y1', baseY)
                .attr('x2', endX).attr('y2', endY)
                .attr('stroke', this.colorScale(d.accidents))
                .attr('stroke-width', currentStroke)
                .attr('stroke-linecap', 'round')
                .attr('opacity', 0.85)
                .attr('data-base-width', currentStroke)
                .attr('data-hover-width', currentHover);
            
            lineGroup.append('line')
                .attr('x1', baseX).attr('y1', baseY)
                .attr('x2', endX).attr('y2', endY)
                .attr('stroke', 'transparent')
                .attr('stroke-width', touchAreaWidth)
                .on('mouseover touchstart', event => {
                    mainLine.attr('stroke-width', currentHover).attr('opacity', 1);
                    this.tooltip
                        .style('opacity', 1)
                        .html(`<strong>Datum:</strong> ${d.date.toLocaleDateString('de-DE')}<br/>
                               <strong>E-Scooter Unfälle:</strong> ${d.accidents}<br/>`)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 10) + 'px');
                })
                .on('mouseout touchend', () => {
                    mainLine.attr('stroke-width', currentStroke).attr('opacity', 0.85);
                    this.tooltip.style('opacity', 0);
                });
        });
    }
    
    createBackgroundArea(g, totalDays, totalRotations, startRadius, radiusIncrease, maxLineHeight) {
        const areaPath = d3.path();
        const numPoints = Math.min(totalDays, 500);
        const pointInterval = Math.max(1, Math.floor(totalDays / numPoints));
        
        // Äußere Spirale (vorwärts)
        for (let i = 0; i < totalDays; i += pointInterval) {
            const angle = -Math.PI / 2 + (i / totalDays) * totalRotations * 2 * Math.PI;
            const radius = startRadius + i * radiusIncrease;
            const [x, y] = [Math.cos(angle) * (radius + maxLineHeight), Math.sin(angle) * (radius + maxLineHeight)];
            i === 0 ? areaPath.moveTo(x, y) : areaPath.lineTo(x, y);
        }
        
        // Innere Spirale (rückwärts)
        for (let i = totalDays - 1; i >= 0; i -= pointInterval) {
            const angle = -Math.PI / 2 + (i / totalDays) * totalRotations * 2 * Math.PI;
            const radius = startRadius + i * radiusIncrease;
            areaPath.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        
        areaPath.closePath();
        
        g.append('path')
            .attr('d', areaPath.toString())
            .attr('fill', '#f1e8d6ff')
            .attr('opacity', 0.3)
            .attr('stroke', 'none');
    }
}

document.addEventListener('DOMContentLoaded', () => new SpiralChart());