describe('Altitude Test', () => {
	it('Energy is set to the expected value', () => {
		cy.visit("./energy.html");
		cy.request("http://localhost:8111/editor/fm_commands?cmd=setVelocity&value=100");
	})
})