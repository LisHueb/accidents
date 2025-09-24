class SpiralChart {
    constructor() {
        this.margin = { top: 10, right: 40, bottom: 40, left: 40 };
        this.data = [];
        this.colorScale = d3.scaleSequential(d3.interpolateViridis).domain([1, 0]); // Umgekehrter Farbverlauf
        
        this.init();
        this.loadData();
    }
    
    init() {
        this.container = d3.select('#spiral');
        this.tooltip = d3.select('#tooltip');
        this.resize();
        
        // Resize-Event für Orientierungsänderungen
        window.addEventListener('resize', () => {
            setTimeout(() => this.resize(), 100);
        });
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resize(), 300);
        });
    }
    
    resize() {
        const containerWidth = d3.select('.spiral-container').node().getBoundingClientRect().width;
        const isMobile = window.innerWidth <= 768;
        
        let size;
        if (isMobile) {
            // Auf mobilen Geräten: Mindestgröße für Lesbarkeit
            size = Math.max(500, Math.min(containerWidth - 20, 600));
        } else {
            // Auf Desktop: Responsive, aber nicht zu groß
            size = Math.min(containerWidth - 40, 900);
        }

        this.width = size;
        this.height = size;
        this.radius = (Math.min(this.width, this.height) - Math.max(this.margin.top + this.margin.bottom, this.margin.left + this.margin.right)) / 2;

        this.container
            .attr('viewBox', `0 0 ${this.width + this.margin.left + this.margin.right} ${this.height + this.margin.top + this.margin.bottom}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .style('width', isMobile ? size + 'px' : '100%')
            .style('height', 'auto');

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
            .attr('height', isMobile ? 60 : 50);

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

        const rectHeight = isMobile ? 20 : 15;
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
        const labelY = isMobile ? 45 : 35;
        const fontSize = isMobile ? '14px' : '12px';

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
            .attr('transform', `translate(${(this.width + this.margin.left + this.margin.right) / 2}, ${(this.height + this.margin.top + this.margin.bottom) / 2})`);
        
        const totalDays = this.data.length;
        const totalRotations = 4;
        const startRadius = 60;
        const endRadius = Math.min(this.width, this.height) / 2 - 80;
        const radiusIncrease = (endRadius - startRadius) / totalDays;
        
        const maxAccidents = d3.max(this.data, d => d.accidents) || 1;
        const heightScale = d3.scaleLinear()
            .domain([0, maxAccidents])
            .range([0, 60]);
        
        const isMobile = window.innerWidth <= 768;
        const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        const defs = g.append('defs');

        months.forEach((month, i) => {
            const dayOffset = -0.5 / totalDays * totalRotations * 2 * Math.PI;
            const angle = -Math.PI / 2 + (i / 12) * 2 * Math.PI + dayOffset;
            const x1 = Math.cos(angle) * (startRadius - 20);
            const y1 = Math.sin(angle) * (startRadius - 20);
            const x2 = Math.cos(angle) * (endRadius + 40);
            const y2 = Math.sin(angle) * (endRadius + 40);

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
                .attr('stroke-width', isMobile ? 1.2 : 0.8);

            const labelRadius = endRadius + 55;
            g.append('text')
                .attr('x', Math.cos(angle) * labelRadius)
                .attr('y', Math.sin(angle) * labelRadius + 4)
                .attr('text-anchor', 'middle')
                .attr('font-size', isMobile ? '14px' : '12px')
                .attr('font-weight', 'bold')
                .attr('fill', '#999')
                .text(month);
        });
            
        // Responsive Stroke-Width und Touch-Bereiche
        const baseStrokeWidth = isMobile ? 2.5 : 1.5;
        const hoverStrokeWidth = isMobile ? 4 : 3;
        const touchAreaWidth = isMobile ? 12 : 8;
            
        this.data.forEach((d, i) => {
            const dayProgress = i / totalDays;
            const angle = -Math.PI / 2 + dayProgress * totalRotations * 2 * Math.PI;
            const radius = startRadius + i * radiusIncrease;
            const baseX = Math.cos(angle) * radius;
            const baseY = Math.sin(angle) * radius;
            const lineHeight = heightScale(d.accidents);
            const endX = Math.cos(angle) * (radius + lineHeight);
            const endY = Math.sin(angle) * (radius + lineHeight);

            const lineGroup = g.append('g').style('cursor', 'pointer');

            const mainLine = lineGroup.append('line')
                .attr('x1', baseX)
                .attr('y1', baseY)
                .attr('x2', endX)
                .attr('y2', endY)
                .attr('stroke', this.colorScale(d.accidents))
                .attr('stroke-width', baseStrokeWidth)
                .attr('stroke-linecap', 'round')
                .attr('opacity', 0.85)
                .attr('data-base-width', baseStrokeWidth);

            // Vergrößerter Touch-Bereich für mobile Geräte
            lineGroup.append('line')
                .attr('x1', baseX)
                .attr('y1', baseY)
                .attr('x2', endX)
                .attr('y2', endY)
                .attr('stroke', 'transparent')
                .attr('stroke-width', touchAreaWidth)
                .on('mouseover touchstart', (event) => {
                    mainLine
                        .attr('stroke-width', hoverStrokeWidth)
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
                    mainLine
                        .attr('stroke-width', baseStrokeWidth)
                        .attr('opacity', 0.85);

                    this.tooltip.style('opacity', 0);
                });
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    new SpiralChart();
});