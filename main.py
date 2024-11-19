from fastapi import FastAPI, Query
import asyncpg
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import datetime
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Explicitly allow your frontend's origin
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],  # Allow all headers
)

# Database connection function
async def get_db_connection():
    return await asyncpg.connect(
        user='postgres',
        password='1234',
        database='data-mypaper',
        host='localhost'
    )

# Convert date string to datetime object
def convert_to_datetime(date_str: str) -> datetime.date:
    try:
        return datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError as e:
        logging.error(f"Invalid date format for {date_str}: {e}")
        raise ValueError("Invalid date format, expected 'YYYY-MM-DD'.")

# Convert time string to datetime object
def convert_to_time(time_str: str) -> datetime.time:
    try:
        return datetime.datetime.strptime(time_str, "%H:%M:%S").time()
    except ValueError as e:
        logging.error(f"Invalid time format for {time_str}: {e}")
        raise ValueError("Invalid time format, expected 'HH:MM:SS'.")

# Endpoint to fetch temperature data with filtering support
@app.get("/temperature-data")
async def get_temperature_data(
    start_date: Optional[str] = Query(None),  # Start date filter (format: 'YYYY-MM-DD')
    end_date: Optional[str] = Query(None),    # End date filter (format: 'YYYY-MM-DD')
    start_time: Optional[str] = Query(None),  # Start time filter (format: 'HH:MM:SS')
    end_time: Optional[str] = Query(None),    # End time filter (format: 'HH:MM:SS')
    bus_no: Optional[str] = Query(None),      # Bus number filter (as text)
):
    conn = await get_db_connection()

    # Convert date strings to datetime objects if they are provided
    if start_date:
        start_date = convert_to_datetime(start_date)
    if end_date:
        end_date = convert_to_datetime(end_date)

    # Convert time strings to time objects if they are provided
    if start_time:
        start_time = convert_to_time(start_time)
    if end_time:
        end_time = convert_to_time(end_time)

    try:
        # Construct the base query
        # Construct the base query
        query = """
        SELECT datestamp, timestamp, latitude, longitude, temperature, bus_no 
        FROM bus_data_v1
        """
        conditions = []
        params = []

        # Dynamically add conditions and parameters
        if start_date:
            conditions.append(f"datestamp >= ${len(params) + 1}")
            params.append(start_date)

        if end_date:
            conditions.append(f"datestamp <= ${len(params) + 1}")
            params.append(end_date)

        if start_time:
            conditions.append(f"timestamp::time >= ${len(params) + 1}")
            params.append(start_time)

        if end_time:
            conditions.append(f"timestamp::time <= ${len(params) + 1}")
            params.append(end_time)

        if bus_no:
            conditions.append(f"bus_no = ${len(params) + 1}")
            params.append(bus_no)

        # Add the conditions to the query
        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        # Fetch the data
        rows = await conn.fetch(query, *params)

        # Prepare the data to return
        data = [
            {
                "latitude": row["latitude"],
                "longitude": row["longitude"],
                "temperature": row["temperature"],
                "datestamp": row["datestamp"],
                "timestamp": row["timestamp"],
                "bus_no": row["bus_no"]
            }
            for row in rows
        ]

        return {"data": data}
    
    except Exception as e:
        logging.error(f"Error fetching data: {e}")
        return {"error": "Internal Server Error", "details": str(e)}
    
    finally:
        await conn.close()
