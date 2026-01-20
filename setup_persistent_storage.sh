#!/bin/bash
# Setup Azure File Share for ChromaDB Persistent Storage

RESOURCE_GROUP="fitfusion-docker-rg"
STORAGE_ACCOUNT="fitfusionstorageacct"
FILE_SHARE_NAME="chromadb-data"
LOCATION="eastus"

echo "🔧 Setting up Azure File Share for persistent ChromaDB storage..."

# Create storage account
echo "📦 Creating storage account: $STORAGE_ACCOUNT"
az storage account create \
  --resource-group $RESOURCE_GROUP \
  --name $STORAGE_ACCOUNT \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2

# Get storage account key
echo "🔑 Getting storage account key..."
STORAGE_KEY=$(az storage account keys list \
  --resource-group $RESOURCE_GROUP \
  --account-name $STORAGE_ACCOUNT \
  --query "[0].value" \
  --output tsv)

# Create file share
echo "📁 Creating file share: $FILE_SHARE_NAME"
az storage share create \
  --name $FILE_SHARE_NAME \
  --account-name $STORAGE_ACCOUNT \
  --account-key "$STORAGE_KEY" \
  --quota 10

echo "✅ Azure File Share created successfully!"
echo ""
echo "📋 Configuration Details:"
echo "Storage Account: $STORAGE_ACCOUNT"
echo "File Share: $FILE_SHARE_NAME"
echo "Storage Key: [HIDDEN]"
echo ""
echo "Next: Deploy container with persistent volume mount"
