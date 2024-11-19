import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { Button, Input, DatePicker } from 'antd';  // For the filter UI
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
    const [filteredData, setFilteredData] = useState({});
    const [filters, setFilters] = useState({
        bus_no: '',
        startDate: null,
        endDate: null,
        startTime: '',
        endTime: '',
    });

    useEffect(() => {
        axios.get('http://localhost:8000/temperature-data')
            .then(response => {
                const groupedData = response.data.data.reduce((acc, item) => {
                    if (item.latitude && item.longitude && item.temperature) {
                        const { bus_no, timestamp } = item;
                        if (!acc[bus_no]) acc[bus_no] = [];
                        acc[bus_no].push({
                            ...item,
                            timestamp: timestamp,  // Keep the timestamp as is for filtering
                        });
                    }
                    return acc;
                }, {});
                console.log(groupedData);  // Log to check data structure
                setBusData(groupedData);
                setFilteredData(groupedData);
            })
            .catch(error => {
                console.error("Error fetching data:", error);
            });
    }, []);
    

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

    const applyFilters = () => {
        const defaultStartDate = "07-01-2024";
        const defaultEndDate = "08-01-2024";
        const { bus_no, startDate, endDate, startTime, endTime } = filters;
    
        let filtered = { ...busData };
    
        // Filter by bus_no
        if (bus_no) {
            filtered = Object.fromEntries(
                Object.entries(filtered).filter(([key]) => key === bus_no)
            );
        }
        const filterStartDate = startDate || defaultStartDate;
        const filterEndDate = endDate || defaultEndDate;

        // Filter by date (startDate and endDate)
        if (startDate || endDate) {
            filtered = Object.fromEntries(
                Object.entries(filtered).map(([bus_no, data]) => [
                    bus_no,
                    data.filter(item => {
                        const itemDate = moment(item.datestamp, 'DD-MM-YYYY'); // Use datestamp for date comparison
                        
                        // Check if startDate and endDate match the item date
                        const isAfterStartDate = startDate ? moment(filterStartDate, 'DD-MM-YYYY').isSameOrBefore(itemDate, 'day') : true;
                        const isBeforeEndDate = endDate ? moment(filterEndDate, 'DD-MM-YYYY').isSameOrAfter(itemDate, 'day') : true;
    
                        return isAfterStartDate && isBeforeEndDate;
                    })
                ])
            );
        }
    
        // Filter by time range (startTime and endTime)
        if (startTime || endTime) {
            filtered = Object.fromEntries(
                Object.entries(filtered).map(([bus_no, data]) => [
                    bus_no,
                    data.filter(item => {
                        const itemTime = item.timestamp; // Use timestamp for time comparison
                        const isAfterStartTime = startTime ? moment(itemTime, 'HH:mm:ss').isSameOrAfter(moment(startTime, 'HH:mm:ss')) : true;
                        const isBeforeEndTime = endTime ? moment(itemTime, 'HH:mm:ss').isSameOrBefore(moment(endTime, 'HH:mm:ss')) : true;
                        return isAfterStartTime && isBeforeEndTime;
                    })
                ])
            );
        }
    
        setFilteredData(filtered);
    };

    // Generate chart data from filtered data
    const generateChartData = () => {
        const chartData = {
            labels: [],
            datasets: []
        };
        
        Object.entries(filteredData).forEach(([bus_no, data]) => {
            const dataset = {
                label: bus_no,
                data: [],
                borderColor: busColors[bus_no]?.gradient ? Object.values(busColors[bus_no].gradient)[1] : 'blue',
                fill: false
            };

            data.forEach(item => {
                const timestamp = moment(item.timestamp).format('HH:mm:ss');
                chartData.labels.push(timestamp);
                dataset.data.push(item.temperature);
            });

            chartData.datasets.push(dataset);
        });

        return chartData;
    };

    return (
        <div style={{ display: 'flex' }}>
            {/* Side Navigation for Filters */}
            <div style={{ width: '250px', padding: '20px' }}>
                <h3>Filter Data</h3>
                
                <Input
                    placeholder="Bus No"
                    value={filters.bus_no}
                    onChange={e => handleFilterChange('bus_no', e.target.value)}
                    style={{ marginBottom: '10px' }}
                />
                
                <RangePicker
                    format="DD-MM-YYYY"
                    onChange={dates => {
                        handleFilterChange('startDate', dates ? dates[0] : null);
                        handleFilterChange('endDate', dates ? dates[1] : null);
                    }}
                    style={{ marginBottom: '10px' }}
                />
                
                <Input
                    placeholder="Start Time (HH:mm:ss)"
                    value={filters.startTime}
                    onChange={e => handleFilterChange('startTime', e.target.value)}
                    style={{ marginBottom: '10px' }}
                />
                
                <Input
                    placeholder="End Time (HH:mm:ss)"
                    value={filters.endTime}
                    onChange={e => handleFilterChange('endTime', e.target.value)}
                    style={{ marginBottom: '10px' }}
                />
                
                <Button onClick={applyFilters}>Apply Filters</Button>
            </div>
            
            {/* Map and Line Graph Container */}
            <div style={{ flexGrow: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Line Graph */}
                    <div style={{ height: '300px', marginBottom: '20px' }}>
                        <Line data={generateChartData()} />
                    </div>

                    {/* Map Container */}
                    <MapContainer 
                        center={[17.393279788513272, 78.40734509206446]} 
                        zoom={13} 
                        style={{ width: "100%", height: "780px" }}
                    >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        
                        {/* Render heatmap layers */}
                        {Object.entries(filteredData).map(([bus_no, heatData], index) => (
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
