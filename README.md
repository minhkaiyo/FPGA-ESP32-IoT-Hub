# Integrated FPGA-ESP32 IoT Control Hub

![Architecture](https://img.shields.io/badge/Architecture-End--to--End-blue)
![Platform](https://img.shields.io/badge/Platform-ESP32%20%2B%20Cyclone%20IV-orange)
![Tech](https://img.shields.io/badge/Tech-Firebase%20%7C%20WebSocket-red)

A complete end-to-end IoT solution that bridges low-level hardware control with modern web technologies. This project allows remote monitoring and control of an FPGA board through a web-based dashboard using an ESP32 as a high-speed communication bridge.

## 🌟 Overview

This system demonstrates the integration of three distinct layers:
1.  **Hardware Layer (FPGA)**: Implements a SPI Slave controller to interface with on-board peripherals (LEDs, HEX displays, LCDs).
2.  **Bridge Layer (ESP32)**: Acts as a gateway, translating high-level network protocols (WebSocket/Firebase) into low-level SPI commands for the FPGA.
3.  **Application Layer (Web)**: A responsive HTML5/JavaScript dashboard for real-time interaction and data visualization.

## 🚀 Features

- **Multi-Protocol Support**: Flexible connectivity via **WebSocket** (low latency), **Firebase Realtime Database** (cloud sync), or **REST API**.
- **Bidirectional Communication**: Not only control FPGA outputs (LEDs, HEX) but also monitor FPGA inputs and internal states in real-time.
- **Modern Dashboard**: Features real-time signal analysis, terminal logging, and a user-friendly interface built with Bootstrap and vanilla JS.
- **Hardware Abstraction**: Verilog modules designed for clean peripheral mapping and robust SPI synchronization.

## 🛠 System Components

- **`/fpga`**: Verilog source files, including `bi_spi_test.v` and top-level integration.
- **`/esp32`**: Arduino firmware for ESP32, handling WiFi connectivity and protocol bridging.
- **`/web`**: Frontend dashboard source code (HTML, CSS, JS).

## 🔧 Getting Started

1.  **FPGA**: Compile the project in Quartus II and flash it to the DE2i-150 board. Connect the ESP32 to the designated SPI pins on the GPIO header.
2.  **ESP32**: Update your WiFi credentials in the `.ino` file and upload it using the Arduino IDE or PlatformIO.
3.  **Web**: Open `web/index.html` in your browser. Configure the IP address of your ESP32 or enter your Firebase credentials to start controlling the hardware.

---
*Developed by Pham Van Minh - Hanoi University of Science and Technology.*
