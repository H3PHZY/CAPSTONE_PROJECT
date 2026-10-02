# Capstone Project Proposal

**Project Title:** EcoLoop: AI-Powered Industrial By-Product Exchange Marketplace  
**Date:** August 20, 2026

#### **1\. Executive Summary & Problem Statement**

Small and Medium Enterprises (SMEs) face significant logistical and financial hurdles in managing industrial waste. Specifically, recyclable materials are frequently mismanaged due to a lack of direct connectivity between waste producers and potential buyers. EcoLoop is a cloud-hosted, web-based marketplace designed to bridge this gap. By leveraging artificial intelligence (YOLOv8) to automate the classification and carbon-footprint calculation of industrial by-products, EcoLoop transforms waste management into a streamlined exchange process. The platform empowers SMEs to monetize their by-products while providing raw material buyers with a reliable, ranked marketplace feed, ultimately driving a circular economy.

#### **2\. Core Features & Functionality (MVP Scope)**

The platform operates on a robust microservices architecture encompassing the following core features:

* **AI-Powered Material Inference & Carbon Calculation:** An isolated Python FastAPI microservice utilizing a preloaded YOLOv8 model (best.pt) to analyze uploaded images. It returns the detected items, calculates estimated material weight, and computes the total carbon footprint offset based on predefined JSON carbon factors.  
*   
* **Role-Based Access Control (RBAC):** Secure onboarding (JWT with bcrypt hashing) tailored for two user roles: Sellers (waste producers) and Buyers (recyclers/manufacturers).  
*   
* **Algorithmic Marketplace Feed:** A ranked listing feed using a custom scoring algorithm that dynamically weighs Material Match (40%), Proximity via the Haversine formula (40%), and Listing Recency (20%).  
*   
* **Transaction & Status Tracking:** End-to-end transaction tracking (POST /api/v1/transactions) that logs the lifecycle of a listing from active to finalized, logging the specific CO2 saved per transaction.


#### **3\. System Architecture & Product Development**

The project utilizes a decoupled architecture deployed on AWS via Infrastructure as Code (IaC).

* **Frontend Client:** A responsive web application built with React and Vite, allowing users to upload images, view the ranked feed, and manage their transactions.  
*   
* **Core Backend (Node.js):** Built with Express.js and Prisma ORM, this service handles high-concurrency HTTP requests, RESTful API routing, rate limiting, and business logic. It integrates with AWS S3 for image storage.  
*   
* **AI Microservice (Python):** An internal, stateless FastAPI service that receives image payloads from the Node.js backend. It operates asynchronously with a strict 3-second timeout to ensure the main event loop remains unblocked during heavy ML inference.  
*   
* **Infrastructure (Terraform & EKS):** The entire stack is provisioned using Terraform (ecoloop-infra), deploying an AWS VPC, EKS cluster, RDS Postgres database, S3 buckets, and ECR registries.


#### **4\. Database Schema (Prisma / PostgreSQL)**

The relational database utilizes PostgreSQL with the following core entities:

* **User:** Manages role, userType (Buyer/Seller), and encrypted credentials.  
*   
* **Listing:** Stores marketplace data including materialType, quantity, price, location (Lat/Long for proximity scoring), and the S3 imageUrl.  
*   
* **Transaction:** Logs the exchange, recording buyerId, sellerId, status, and total co2Saved.  
*   
* **AI\_Log:** Audits ML performance, tracking the predictedClass, confidenceScore, and inferenceLatency for continuous model improvement.


#### **5\. Deployment & CI/CD Pipeline**

The product lifecycle is fully automated via GitHub Actions:

1. **Continuous Integration:** On push/pull requests to main, the pipeline sets up Node.js, lints the codebase, executes test suites, and builds the application.  
2.   
3. **Containerization:** The Node.js backend and Python AI service are containerized using Docker.  
4.   
5. **Continuous Deployment:** The pipeline authenticates with AWS OIDC, builds the Docker images, pushes them to the Amazon Elastic Container Registry (ECR), and triggers a kubectl rollout to update the pods running on the EKS cluster.  
   

#### **6\. Technology Stack Summary**

* **Frontend:** React, Vite  
*   
* **Core Backend:** Node.js v20+, Express.js, Prisma ORM  
*   
* **AI Microservice:** Python 3.10+, FastAPI, YOLOv8  
*   
* **Database:** PostgreSQL 15+, Redis  
*   
* **Cloud & Infrastructure:** AWS (EKS, RDS, S3, ECR), Terraform, Docker, Kubernetes  
*   
* **Security:** JWT, bcrypt, Helmet, express-validator  
  