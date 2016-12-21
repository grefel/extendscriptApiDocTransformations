<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:xs="http://www.w3.org/2001/XMLSchema"
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xmlns:omv="http://schema.adobe.com/omv/1.0/omv.xsd"	
	exclude-result-prefixes="xs omv xsi"
	version="2.0">
	
	<xsl:variable name="debug" select="false()" as="xs:boolean"/>
	
	<xsl:output method="xml" indent="yes"/>
	
	<xsl:param name="product.xml">sourceXML/omv$indesign-12.064$12.0.xml</xsl:param>
	<xsl:param name="javascript.xml">sourceXML/javascript.xml</xsl:param>
	<xsl:param name="scriptui.xml">sourceXML/scriptui.xml</xsl:param>
	
	
	<!-- Gathering Required Files -->
	<xsl:template name="mergeDOMFiles">
		<xsl:if test="not(doc-available($javascript.xml) or doc-available($product.xml) or doc-available($scriptui.xml))">
			<xsl:message><xsl:text>[Caution] Not all Files are available! </xsl:text>
				<xsl:value-of select="$product.xml"/> <xsl:text>, </xsl:text>
				<xsl:value-of select="$javascript.xml"/> <xsl:text>, </xsl:text>
				<xsl:value-of select="$scriptui.xml"/> 
			</xsl:message>
		</xsl:if>
		
		<domRoot>
			<js>
				<xsl:apply-templates select="document($javascript.xml)"/>
			</js>
			<sui>
				<xsl:apply-templates select="document($scriptui.xml)"/>
			</sui>
			<product>
				<xsl:apply-templates select="document($product.xml)"/>
			</product>
		</domRoot>
		
	</xsl:template>
	
	<!-- Copy all -->
	<xsl:template match="node()|@*" priority="-1">
		<xsl:copy exclude-result-prefixes="#all" inherit-namespaces="no" copy-namespaces="no">
			<xsl:apply-templates select="node()|@*"/>
		</xsl:copy>
	</xsl:template>	
	<!--Get rid of omv Namespace--> 
	<xsl:template match="*">
		<xsl:element name="{name()}" >
			<xsl:apply-templates select="@*|node()"/>
		</xsl:element>
	</xsl:template>
	<xsl:template match="omv:dictionary">
		<xsl:element name="dictionary" inherit-namespaces="no">
			<xsl:apply-templates/>			
		</xsl:element>
	</xsl:template>
	
</xsl:stylesheet>