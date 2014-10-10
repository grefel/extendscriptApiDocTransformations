<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:px="http://www.publishingx.de"
	exclude-result-prefixes="xs px" version="2.0">

	<xsl:param name="debug" select="false()" as="xs:boolean"/>
	<xsl:param name="allOut" select="true()" as="xs:boolean"/>

	<!-- Keys for Linking Classes -->
	<xsl:key name="className" match="classdef" use="@name"/>
	<xsl:key name="properties" match="property" use="datatype/type"/>
	<xsl:key name="retunrValues" match="method" use="datatype/type"/>
	

	
	<!-- Root -->
	<xsl:template match="/">
		<xsl:apply-templates select="//classdef"/>

		<xsl:variable name="outPath" select="concat('extendScriptAPI', '.ditamap')"/>
		<xsl:result-document href="{$outPath}" doctype-public="-//OASIS//DTD DITA Map//EN"
			doctype-system="map.dtd" indent="yes">
			<xsl:element name="map">
				<title>InDesign ExtendScript API</title>
				<topichead navtitle="About">
					<topicref href="../about.dita"/>						
				</topichead>
				<topichead>
					<xsl:attribute name="navtitle" select="/domRoot/indd/dictionary/map/@title"/>
					
					<!-- Mini Hierarchy-->
					<topicref href="Application.dita">							
						<topicref href="Document.dita">
							<topicref href="Page.dita">
								<topicref href="PageItem.dita">
									<topicref href="Graphic.dita">
										<!--...-->
									</topicref>									
								</topicref>
								<topicref href="TextFrame.dita">
									<topicref href="Story.dita">
										<topicref href="Paragraph.dita">
											<topicref href="ParagraphStyle.dita"/>
											<topicref href="Character.dita">
												<topicref href="CharacterStyle.dita"/>
											</topicref>
										</topicref>
										<topicref href="Table.dita">
											<topicref href="TableStyle.dita"/>
											<topicref href="Row.dita">
												<topicref href="Cell.dita">
													<topicref href="CellStyle.dita"/>
												</topicref>																					
											</topicref>																				
										</topicref>									
									</topicref>
								</topicref>							
							</topicref>							
							<topicref href="Link.dita">
								<!--...-->
							</topicref>
						</topicref>
					</topicref>
					
					<xsl:if test="$allOut">
						<xsl:apply-templates select="/domRoot/indd/dictionary/map"/>
					</xsl:if>
				</topichead>

				<xsl:if test="$allOut">
					<xsl:apply-templates select="/domRoot/js/dictionary/map"/>
					<xsl:apply-templates select="/domRoot/sui/dictionary/map"/>
				</xsl:if>
			</xsl:element>
		</xsl:result-document>
	</xsl:template>

	<!-- Building the Map/Hierarchy-->
	<xsl:template match="map">
		<xsl:apply-templates/>
	</xsl:template>

	<xsl:template match="topicref">
		<xsl:element name="topichead">
			<xsl:attribute name="navtitle" select="@navtitle"/>
			<xsl:apply-templates/>
		</xsl:element>
	</xsl:template>

	<xsl:template match="topicref/topicref">
		<xsl:element name="topicref">
			<xsl:attribute name="href" select="concat(@href, '.dita')"/>
			<xsl:apply-templates/>
		</xsl:element>
	</xsl:template>

	<!-- Processing Classes 	-->
	<xsl:template match="classdef">
		<xsl:variable name="classdefID" select="generate-id(.)"/>
		<xsl:variable name="className" select="@name"/>
		<xsl:variable name="outPath" select="concat($className, '.dita')"/>
		
		<xsl:result-document href="{$outPath}" doctype-public="-//OASIS//DTD DITA Topic//EN" doctype-system="topic.dtd" indent="yes">
			
			<topic id="{$classdefID}">
				<title><keyword><xsl:value-of select="px:fixSUI($className)"/></keyword></title>
				<body>
					<p><indexterm><xsl:value-of select="$className"/></indexterm><xsl:value-of select="shortdesc"/></p>
					<!--Generating Method Quicklinks-->
					<xsl:if test="elements[@type='instance']/method">
						<section>
						<title>Methods:</title>
						<p>
							<xsl:for-each select="elements[@type='instance']/method">
								<xsl:text> </xsl:text>
								<xref href="{concat('#', $classdefID, '/', generate-id(.))}">
									<xsl:value-of select="@name"/>
								</xref>
							</xsl:for-each>
						</p>
						</section>
					</xsl:if>
					<!--Generating Object Quicklinks-->
					<xsl:if test="elements[@type='instance']/property">
						<section>
						<title>Objects:</title>
						<p>
							<xsl:for-each-group select="elements[@type='instance']/property/datatype" group-by="type">
								<xsl:sort select="type"/>
								<xsl:if test="$debug">
									<xsl:comment>
										<xsl:value-of select="concat('|',datatype/type/text(),'|')"/>
									</xsl:comment>
								</xsl:if>
								<xsl:if test="current-group()[1]/type != 'Varies'">
									<xsl:call-template name="linkToClassName">
										<xsl:with-param name="writeFails" select="$debug"/>
										<xsl:with-param name="typeName" select="current-group()[1]/type"/>									
									</xsl:call-template>
									<xsl:text> </xsl:text>									
								</xsl:if>
							</xsl:for-each-group>
						</p>
						</section>
					</xsl:if>
					<!-- Link to Superclass -->					
					<xsl:if test="superclass">
						<section>
						<title>uperclass:</title>
						<p>
							<xsl:call-template name="linkToClassName">
								<xsl:with-param name="typeName" select="superclass"/>
							</xsl:call-template>
						</p>
						</section>
					</xsl:if>

					<!--Generating Property Table-->
					<xsl:choose>
						<!--Eumeration-->
						<xsl:when test="@enumeration='true'">
							<section>
								<title>Values</title>
								<table frame="all" rowsep="1" colsep="1">
									<tgroup cols="3">
										<colspec colname="c1" colnum="1" colwidth="0.2*"/>
										<colspec colname="c2" colnum="2" colwidth="0.7*"/>
										<colspec colname="c3" colnum="3" colwidth="0.1*"/>
										<thead>
											<row>
												<entry><p>Name</p></entry>
												<entry><p>Description</p></entry>
												<entry><p>Value</p></entry>
											</row>
										</thead>
										<tbody>
											<xsl:for-each select="elements[@type='class']/property">
												<xsl:sort select="@name"/>
												<row>
													<entry><p><xsl:value-of select="@name"/></p></entry>
													<entry><p><xsl:value-of select="shortdesc"/></p></entry>
													<entry><p><xsl:value-of select="datatype/value"/></p></entry>
												</row>
											</xsl:for-each>
										</tbody>
									</tgroup>
								</table>
							</section>
						</xsl:when>
						<!--Class Properties--> 
						<xsl:otherwise>
							<xsl:if test="elements[@type='instance']/property">
								<section>
									<title>Properties</title>
									<table frame="all" rowsep="1" colsep="1">
										<tgroup cols="4">
											<colspec colname="c1" colnum="1" colwidth="0.2*"/>
											<colspec colname="c2" colnum="2" colwidth="0.2*"/>
											<colspec colname="c3" colnum="3" colwidth="0.1*"/>
											<colspec colname="c4" colnum="4" colwidth="0.5*"/>
											<thead>
												<row>
													<entry><p>Property</p></entry>
													<entry><p>Type</p></entry>
													<entry><p>Access</p></entry>
													<entry><p>Description</p></entry>
												</row>
											</thead>
											<tbody>
												<xsl:for-each select="elements[@type='instance']/property">
													<xsl:sort select="@name"/>
													<xsl:apply-templates  select="." mode="Property"/>
												</xsl:for-each>
											</tbody>
										</tgroup>
									</table>
								</section>
							</xsl:if>

							<xsl:if test="elements[@type='class']/property">
								<section>
									<title>Constants/Events</title>
									<table frame="all" rowsep="1" colsep="1">
										<tgroup cols="4">
											<colspec colname="c1" colnum="1" colwidth="0.2*"/>
											<colspec colname="c2" colnum="2" colwidth="0.1*"/>
											<colspec colname="c3" colnum="3" colwidth="0.1*"/>
											<colspec colname="c4" colnum="4" colwidth="0.6*"/>
											<thead>
												<row>
													<entry><p>Name</p></entry>
													<entry><p>Type</p></entry>
													<entry><p>Access</p></entry>
													<entry><p>Description</p></entry>
												</row>
											</thead>
											<tbody>
												<xsl:for-each select="elements[@type='class']/property">
													<xsl:sort select="@name"/>
													<xsl:apply-templates select="." mode="Constant"/>
												</xsl:for-each>
											</tbody>
										</tgroup>
									</table>
								</section>
							</xsl:if>

							<xsl:if test="elements[@type='instance']/method">
								<section>
									<title>Methods</title>
									<xsl:for-each select="elements[@type='constructor']/method">
										<xsl:sort select="@name"/>
										<p><b>Constructor</b></p>
										<xsl:apply-templates select="."/>
									</xsl:for-each>
									<xsl:for-each select="elements[@type='instance']/method">
										<xsl:sort select="@name"/>
										<xsl:apply-templates select="."/>
									</xsl:for-each>
								</section>
							</xsl:if>

						</xsl:otherwise>
					</xsl:choose>

					<!--Creating Links to Properties with this object-->
					<xsl:if test="key('properties', $className)">
					<section>
						<title>Object of</title>
						<xsl:for-each select="key('properties', $className)">
							<p>
								<xsl:call-template name="generatClassLink">
									<xsl:with-param name="typeName" select="parent::elements/parent::classdef/@name"/> 
								</xsl:call-template>
								<xsl:text>.</xsl:text>
								<xsl:value-of select="@name"></xsl:value-of>
							</p>
						</xsl:for-each>
					</section>
					</xsl:if>
					
					<!--Creating Links to Methods with this object-->
					<xsl:if test="key('retunrValues', $className)">
					<section>
						<title>Return</title>
						<xsl:for-each select="key('retunrValues', $className)">
							<xsl:variable name="destinationClassdef" select="parent::elements/parent::classdef/@name"></xsl:variable>
							<p>
								<xsl:call-template name="generatClassLink">
									<xsl:with-param name="typeName" select="$destinationClassdef"/>
									<xsl:with-param name="createShortcut" select="false()"/>
								</xsl:call-template>
								<xsl:text>.</xsl:text>
								<xref href="{concat($destinationClassdef, '.dita#', generate-id(.))}">
									<xsl:value-of select="@name"/>
								</xref>
								<xsl:text>()</xsl:text>
							</p>
					</xsl:for-each>
					</section>
					</xsl:if>
				</body>
			</topic>
		</xsl:result-document>
	</xsl:template>

	<!-- Processing Events and Constants	-->
	<xsl:template match="property" mode="Constant">
		<row>
			<entry><p><xsl:value-of select="@name"/></p></entry>
			<entry>
				<xsl:apply-templates select="datatype"/>
			</entry>
			<entry><p>readonly</p></entry>
			<entry><p><xsl:value-of select="shortdesc"/></p>
			</entry>
		</row>

	</xsl:template>
	<!-- Processing Properties 	-->
	<xsl:template match="property" mode="Property">
		<xsl:element name="row">
			<entry>
				<p><xsl:value-of select="@name"/></p>
			</entry>
			<entry>
				<xsl:apply-templates select="datatype"/>
			</entry>
			<entry>
				<p>
					<xsl:value-of select="@rwaccess"/>
				</p>
			</entry>
			<entry>
				<p>
					<xsl:value-of select="shortdesc"/>
				</p>
			</entry>
		</xsl:element>
	</xsl:template>
	<!-- Processing Methods -->
	<xsl:template match="method">
		<p outputclass="methodName" id="{generate-id(.)}">
			<!-- Return value -->
			<xsl:choose>
				<xsl:when test="datatype">
					<xsl:call-template name="generatClassLink">
						<xsl:with-param name="typeName" select="type"></xsl:with-param>
					</xsl:call-template>
				</xsl:when>
				<xsl:otherwise>
					<xsl:text>undefined</xsl:text>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:text> </xsl:text>
			
			<!-- Function Name -->
			<xsl:if test="$debug">
				<xsl:message select="@name"/>
			</xsl:if>
			<b><xsl:apply-templates select="@name"/></b>

			<!-- Parameters -->
			<xsl:text> (</xsl:text>
			<xsl:for-each select="parameters/parameter">
				<xsl:if test="@optional='true'">[</xsl:if>
				<xsl:value-of select="@name"/>
				<xsl:text>:</xsl:text>
				<i>
					<xsl:if test="datatype/array">
						<xsl:text>Array of </xsl:text>
					</xsl:if>
					<xsl:value-of select="datatype/type"/>
				</i>
				<xsl:if test="datatype/value">
					<xsl:text>=</xsl:text>
					<xsl:value-of select="datatype/type"/>
				</xsl:if>
				<xsl:if test="@optional='true'">]</xsl:if>
				<xsl:if test="position() != last()">
					<xsl:text>, </xsl:text>
				</xsl:if>
			</xsl:for-each>
			<xsl:text>)</xsl:text>
		</p>

		<p>
			<xsl:value-of select="shortdesc"/>
		</p>

		<xsl:if test="parameters/parameter">
			<table frame="all" rowsep="1" colsep="1">
				<tgroup cols="3">
					<colspec colname="c1" colnum="1" colwidth="0.3*"/>
					<colspec colname="c2" colnum="2" colwidth="0.1*"/>
					<colspec colname="c3" colnum="3" colwidth="0.6*"/>
					<thead>
						<row>
							<entry><p>Parameter</p></entry>
							<entry><p>Type</p></entry>
							<entry><p>Description</p></entry>
						</row>
					</thead>
					<tbody>
						<xsl:apply-templates select="parameters/parameter"/>
					</tbody>
				</tgroup>
			</table>
		</xsl:if>
	</xsl:template>
	<xsl:template match="parameter">
		<row>
			<entry>
				<p><xsl:value-of select="@name"/></p>
			</entry>
			<entry>
				<xsl:apply-templates select="datatype"/>
			</entry>
			<entry>
				<p>
					<xsl:value-of select="shortdesc"/>
					<xsl:if test="datatype/value">
						<xsl:text> (default: </xsl:text>
						<xsl:value-of select="datatype/value"/>
						<xsl:text>)</xsl:text>
					</xsl:if>
				</p>
			</entry>
		</row>
	</xsl:template>


	<!-- Processing Types -> Link to Class -->
	<xsl:template match="datatype">
			<xsl:if test="$debug">
				<xsl:comment>
					<xsl:value-of select="."/>
				</xsl:comment>
			</xsl:if>
			<xsl:if test="not(type='Varies' and count(following-sibling::datatype) > 0)">
				
				<xsl:for-each select="type">
					<xsl:variable name="typeName" select="."/>
					<p>					
						<xsl:call-template name="generatClassLink"/>
					</p>
							
					<!-- Resolcve Enum Values in property Table-->
					<xsl:if test="key('className', $typeName)/@enumeration = 'true'">
						<xsl:choose>
							<xsl:when test="$typeName = 'NothingEnum'">
								<p outputclass="enumInPTable">NothingEnum.NOTHING</p>
							</xsl:when>
							<xsl:when test="$typeName = 'InCopyUIColors' or $typeName = 'UIColors'">
								<!-- Do not resolve -->
							</xsl:when>
							<xsl:otherwise>
								<p outputclass="enumInPTableTitle">Enumeration</p>
								<xsl:for-each select="key('className', $typeName)/elements[@type='class']/property">
									<p outputclass="enumInPTable">
										<xsl:value-of select="$typeName"/>
										<xsl:text>.</xsl:text>
										<xsl:value-of select="@name"/>
									</p>
								</xsl:for-each>								
							</xsl:otherwise>
						</xsl:choose>
					</xsl:if>
		
				</xsl:for-each>
			</xsl:if>
		
	</xsl:template>

	<xsl:template name="generatClassLink">
		<xsl:param name="typeName" select="."/>
		<xsl:param name="createShortcut" select="true()"/>
		
		<xsl:if test="parent::datatype/array">
			<xsl:variable name="id" select="generate-id(key('className','Array'))"/>
			<xsl:choose>
				<xsl:when test="$id">
					<xsl:variable name="ref" select="concat('Array.dita#', $id)"/>
					<xsl:element name="xref">
						<xsl:attribute name="href" select="$ref"/>
					</xsl:element>
				</xsl:when>
				<xsl:otherwise>
					<xsl:text>Array</xsl:text>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:text> of </xsl:text>
		</xsl:if>

		<!-- Link to class-->
		<xsl:call-template name="linkToClassName">
			<xsl:with-param name="typeName" select="$typeName"/>
		</xsl:call-template>

		<xsl:if test="is">
			<xsl:text> as</xsl:text>
			<xsl:value-of select="is"/>
		</xsl:if>
		
		<xsl:if test="$createShortcut and ends-with($typeName, 's') and not(ends-with($typeName, 'preferences') or ends-with($typeName, 'options') or ends-with($typeName, 'Varies'))">
			<xsl:variable name="shortType" select="replace(replace($typeName,'(ies$)','y'), 's$','')"/>
			<xsl:variable name="id" select="generate-id(key('className',$shortType))"/>
			<xsl:if test="$id">
				<i><xsl:text> Shortcut </xsl:text></i>
				<xsl:variable name="ref" select="concat($shortType, '.dita#', $id)"/>
				<xsl:element name="xref">
					<xsl:attribute name="href" select="$ref"/>
				</xsl:element>
			</xsl:if>
		</xsl:if>

		<!--(range: 0 - 11)-->
		<xsl:if test="parent::datatype/min and parent::datatype/max">
			<xsl:text> (range </xsl:text>
			<xsl:value-of select="parent::datatype/min"/>
			<xsl:text> - </xsl:text>
			<xsl:value-of select="parent::datatype/max"/>
			<xsl:text>)</xsl:text>
		</xsl:if>
	</xsl:template>
	<!-- Create an xref Link to Class if possible	-->
	<xsl:template name="linkToClassName">
		<xsl:param name="typeName"/>
		<xsl:param name="writeFails" select="true()"/>
		<xsl:variable name="id" select="/generate-id(key('className',$typeName))"/>
		<xsl:choose>
			<xsl:when test="$id">
				<xsl:variable name="ref" select="concat($typeName,'.dita#', $id)"/>
				<xsl:element name="xref">
					<xsl:attribute name="href" select="$ref"/>
				</xsl:element>
			</xsl:when>
			<xsl:otherwise>
				<xsl:if test="$writeFails">
					<xsl:value-of select="$typeName"/>
				</xsl:if>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	
	<xsl:function name="px:fixSUI">
		<xsl:param name="text"></xsl:param>
		<xsl:value-of select="replace($text,'SUI$',' (SUI)')"/>
	</xsl:function>

</xsl:stylesheet>
