import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { Button, Input, DatePicker, TimePicker } from 'antd'; 
import moment from 'moment';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend } from 'chart.js';

// Initialize chart.js components
ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend);

const { RangePicker } = DatePicker;

const HeatmapLayer = ({ heatData, options }) => {
    const map = useMap();

    useEffect(() => {
        if (heatData.length > 0) {
            const heatLayer = L.heatLayer(heatData, options);
            heatLayer.addTo(map);

            return () => {
                map.removeLayer(heatLayer);
            };
        }
    }, [heatData, options, map]);

    return null;
};

const HeatmapMap = () => {
    const [busData, setBusData] = useState({});
    const [filters, setFilters] = useState({
        bus_no: '',
        startDate: '',
        endDate: '',
        startTime: '',  
        endTime: '',    
    });

    useEffect(() => {
        const { startDate, endDate, startTime, endTime, bus_no } = filters;
        let url = 'http://localhost:8000/temperature-data';
    
        if (startDate || endDate || startTime || endTime || bus_no) {
            const formattedStartDate = startDate ? moment(startDate).format('YYYY-MM-DD') : '';
            const formattedEndDate = endDate ? moment(endDate).format('YYYY-MM-DD') : '';
            const formattedStartTime = startTime ? moment(startTime, 'HH:mm:ss').format('HH:mm:ss') : '';
            const formattedEndTime = endTime ? moment(endTime, 'HH:mm:ss').format('HH:mm:ss') : '';

            url += `?start_date=${formattedStartDate}&end_date=${formattedEndDate}&start_time=${formattedStartTime}&end_time=${formattedEndTime}&bus_no=${bus_no}`;
        }
        console.log(url);  // Check if the URL is correct
    
        axios.get(url)
            .then(response => {
                const groupedData = response.data.data.reduce((acc, item) => {
                    if (item.latitude && item.longitude && item.temperature_c) {
                        const { bus_no, datestamp, timestamp, latitude, longitude, temperature_c } = item;
                        if (!acc[bus_no]) acc[bus_no] = [];
                        acc[bus_no].push({
                            bus_no,
                            datestamp,  // Date without formatting
                            timestamp,  // Time without formatting
                            latitude,
                            longitude,
                            temperature: temperature_c, // Temperature field
                        });
                    }
                    return acc;
                }, {});
                setBusData(groupedData);
            })
            .catch(error => {
                console.error("Error fetching data:", error);
            });
    }, [filters]);  

    const busColors = {
        "bus1": { radius: 5, blur: 2, gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'green' } },
        "bus2": { radius: 5, blur: 2, gradient: { 0.4: 'yellow', 0.65: 'orange', 1: 'purple' } },
        "bus3": { radius: 5, blur: 2, gradient: { 0.4: 'pink', 0.65: 'brown', 1: 'gold' } },
        "bus4": { radius: 5, blur: 2, gradient: { 0.4: 'grey', 0.65: 'lightblue', 1: 'silver' } },
    };

    const handleFilterChange = (field, value) => {
        setFilters(prevFilters => ({
            ...prevFilters,
            [field]: value,
        }));
    };

    const generateChartData = () => {
        const chartData = {
            labels: [],
            datasets: [],
        };
    
        // Create a map to store the data for each bus and their corresponding datestamps and timestamps
        const combinedData = {};
    
        Object.entries(busData).forEach(([bus_no, data]) => {
            data.forEach(item => {
                const { datestamp, timestamp, temperature } = item;
                const datetime = datestamp ;  // Combine date and time for plotting
    
                // If the datestamp does not exist, initialize it
                if (!combinedData[datestamp]) {
                    combinedData[datestamp] = [];
                }
    
                // Push the data point for each bus with its datetime and temperature
                combinedData[datestamp].push({
                    bus_no,
                    temperature,
                    datetime,
                });
            });
        });
    
        // Sort the datestamps
        const sortedDates = Object.keys(combinedData).sort((a, b) => new Date(a) - new Date(b));
    
        // Loop through the sorted datestamps and create datasets for each bus
        sortedDates.forEach(date => {
            // Add unique datestamp to the x-axis labels (only once)
            chartData.labels.push(date);
    
            // For each bus, plot all the points for that datestamp
            Object.entries(busData).forEach(([bus_no, data]) => {
                const busDataForDate = combinedData[date].filter(item => item.bus_no === bus_no);
                
                // Push the temperature data points for each bus
                const dataset = chartData.datasets.find(ds => ds.label === bus_no);
                if (dataset) {
                    busDataForDate.forEach(item => {
                        dataset.data.push({
                            x: item.datetime,  // Use full datetime as x value
                            y: item.temperature,  // Temperature as y value
                        });
                    });
                } else {
                    // If dataset for the bus doesn't exist, create one and add data points
                    chartData.datasets.push({
                        label: bus_no,
                        data: busDataForDate.map(item => ({
                            x: item.datetime,
                            y: item.temperature,
                        })),
                        borderColor: busColors[bus_no]?.gradient ? Object.values(busColors[bus_no].gradient)[1] : 'blue',
                        pointRadius: 5,  // Small circles for each point
                        fill: false,
                    });
                }
            });
        });
    
        return chartData;
    };
    
    return (
        <div style={{ display: 'flex' }}>
            <div style={{ width: '250px', padding: '20px' }}>
                <h3>Filter Data</h3>

                <Input
                    placeholder="Bus No"
                    value={filters.bus_no}
                    onChange={e => handleFilterChange('bus_no', e.target.value)}
                    style={{ marginBottom: '10px' }}
                />

                <RangePicker
                    format="YYYY-MM-DD"
                    onChange={dates => {
                        if (dates && dates.length === 2) {
                            handleFilterChange('startDate', dates[0].format('YYYY-MM-DD'));
                            handleFilterChange('endDate', dates[1].format('YYYY-MM-DD'));
                        } else {
                            handleFilterChange('startDate', '');
                            handleFilterChange('endDate', '');
                        }
                    }}
                    style={{ marginBottom: '10px' }}
                />

                <TimePicker
                    format="HH:mm:ss"
                    value={filters.startTime ? moment(filters.startTime, 'HH:mm:ss') : null}
                    onChange={time => handleFilterChange('startTime', time ? time.format('HH:mm:ss') : '')}
                    placeholder="Start Time"
                    style={{ marginBottom: '10px', width: '100%' }}
                />

                <TimePicker
                    format="HH:mm:ss"
                    value={filters.endTime ? moment(filters.endTime, 'HH:mm:ss') : null}
                    onChange={time => handleFilterChange('endTime', time ? time.format('HH:mm:ss') : '')}
                    placeholder="End Time"
                    style={{ marginBottom: '10px', width: '100%' }}
                />

                {/* <Button onClick={() => {}}>Apply Filters</Button> */}
            </div>

            <div style={{ flexGrow: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: '300px', marginBottom: '20px' }}>
                        <Line data={generateChartData()} />
                    </div>

                    <MapContainer 
                        center={[17.393279788513272, 78.40734509206446]} 
                        zoom={13} 
                        style={{ width: "100%", height: "780px" }}
                    >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                        {Object.entries(busData).map(([bus_no, heatData], index) => (
                            <HeatmapLayer 
                                key={index} 
                                heatData={heatData.map(item => [
                                    item.latitude,
                                    item.longitude,
                                    item.temperature
                                ])} 
                                options={busColors[bus_no] || { radius: 5, blur: 5 }} 
                            />
                        ))}
                    </MapContainer>
                </div>
            </div>
        </div>
    );
};

export default HeatmapMap;
